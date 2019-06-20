// Title to give events that are created to hold rooms (when the original
// event cannot be modified).
const roomHoldEventTitle = 'Room hold (by RoomAssistant)';

function doSync({fullSync = false} = {}) {
    var events = getSyncEvents({fullSync: fullSync});
    Logger.log("Syncing :", events.length, " events");

    // Index events by date
    var eventsByDate = {};
    for (event of events) {
        // Cancelled events sometimes returned during incremental sync
        // (and also for cancelled exceptions to repeated events, but we
        // don't care about dropping those since we expand repeated events.)
        if (event.status == 'cancelled') continue;
        
        var date;
        if (event.start.date) {
            dateParts = event.start.date.split('-');
            if (dateParts.length != 3) {
                throw new Error('Bad date: ' + event.start.date);
            }
            date = startOfDate(today());
            date.setYear(dateParts[0]);
            date.setMonth(dateParts[1] - 1);
            date.setDate(dateParts[2]);
        } else {
            date = startOfDate(event.start.dateTime);
        }
        if (!eventsByDate.hasOwnProperty(date)) {
            eventsByDate[date] = [event];
        } else {
            eventsByDate[date].push(event);
        }
    }

    // Roomify each date
    initResources();
    var failedEvents = [];
    for (d in eventsByDate) {
        var events = eventsByDate[d];
        var date = new Date(d);
        var dateString = date.toLocaleDateString("en-US");
        var buildingId = buildingFromEvents(events);
        if (buildingId == null) {
            buildingId = buildingFromDirectoryOrDie();
        }
        if (buildingId === 'skip') {
            Logger.log("User is not in the office on ", dateString);
            continue;
        }

        // Get rooms in buildingId and index by email
        Logger.log("User is in ", buildingId, " on ", dateString);
        var rooms = rankedRoomsIn(buildingId);
        var roomsByEmail = {}; // rooms in the building the user is in this day
        for (room of rooms) {
          roomsByEmail[room.resourceEmail] = room;
        }
      
        // Loop through events
        for (event of events) {
            if (event.summary === roomHoldEventTitle) continue; // skip room holds
            if (event.start.date) continue; // skip all-day events

            var roomRequested = event.summary.toLowerCase().includes('room');
            var hasAttendees = event.attendees && event.attendees.length > 0;
            var numAttendees = hasAttendees ? event.attendees.length : 0;

            // numAttendees == 
            //   0: just the user (no guests, no rooms)
            //   1: attendee list too large to display (e.g. all-hands)
            //       - roomify only if the user actively accepted (checked below)
            //       - NB: event.attendeesOmitted doesn't work to detect big meetings
            //   2: event has one other guest or a room, plus the user
            //       - Yes, adding *just* a room to an empty event bumps
            //         numAttendees from 0 to 2...
            if (!roomRequested) {
                if (numAttendees == 0) continue; // skip non-meetings
                // numAttendees == 1 (all-hands) checked below
            }

            var humans = 0;
            var userResponse;
            var hasRoom = false;
            for (attendee of event.attendees) {
                if (attendee.self) userResponse = attendee.responseStatus;
                if (!attendee.resource) humans++;

                // Already have a room?
                if (attendee.resource && attendee.responseStatus == 'accepted' && roomsByEmail.hasOwnProperty(attendee.email)) {
                    hasRoom = true;
                } else {
                    // Already have a room hold?
                    for (holdEvent in events) {
                        if (holdEvent.summary != roomHoldEventTitle) continue;
                        if (holdEvent.start.dateTime === event.start.dateTime && holdEvent.end.dateTime === event.end.dateTime) {
                            hasRoom = true;
                            break;
                        }
                    }        
                }
            }
            if (userResponse == 'declined') continue;
            if (!roomRequested) {
                if (numAttendees == 1 && userResponse != 'accepted') continue; // skip all-hands that are not accepted
                if (humans == 0) throw new Error("Event has attendees but no humans"); // unexpected
                if (humans == 1) continue; // skip non-meetings
            }
            if (hasRoom) {
                // Clean up declined rooms if we have a room already, then skip the event.
                //
                // Declined rooms are kept to avoid trying to add them again in subsequent
                // rounds, so only clear them if we have a room in the user's building and
                // then only for that building.
                var newEvent = {attendees: []};
                var removed = [];
                for (attendee of event.attendees) {
                    // Leave out attendees that are resources, have declined and are in
                    // the user's building.
                    if (attendee.resource && attendee.responseStatus == 'declined' && roomsByEmail.hasOwnProperty(attendee.email)) {
                        removed.push(attendee.generatedResourceName);
                    } else {
                        newEvent.attendees.push({
                            email: attendee.email,
                            resource: attendee.resource
                        });
                    }
                }
                if (removed.length > 0) {
                    try {
                        if (!dryRun) {
                            Calendar.Events.patch(
                                newEvent,
                                'primary',
                                event.id,
                                {sendUpdates: 'none'},
                                {'If-Match': event.etag}
                            );
                        }
                        Logger.log('Removed declined rooms from \'' + event.summary + '\': ' + JSON.stringify(removed));
                        if (dryRun) Logger.log("(dry run, nothing modified)");
                    } catch (e) {
                        Logger.log('Patch threw an exception: ' + JSON.stringify(e));
                    }
                }
                continue; // don't roomify the event (has a room already)
            }

            Logger.log("ROOMIFYING: " + event.summary + "' (" + humans + " humans, " + numAttendees + " attendees) on " + dateString);

            var roomGen = availableRoomGenerator(rooms, event.start.dateTime, event.end.dateTime);
            var roomAdded = false;
            roomLoop:
            for (room of roomGen) {
                // Don't try to re-add a room that has already declined this event
                for (attendee of event.attendees) {
                    if (!attendee.resource) continue;
                    if (attendee.email === room.email && attendee.responseStatus == 'declined') {
                        continue roomLoop;
                    }
                }

                Logger.log("ADD: " + room.generatedResourceName + " to '" + event.summary + "' (" + humans + " humans, " + numAttendees + " attendees) on " + dateString);
                var newEvent = {attendees: Array.from(event.attendees)};
                newEvent.attendees.push({
                    email: room.resourceEmail,
                    resource: true
                });
                Logger.log("Original event: " + JSON.stringify(event));
                Logger.log("Room: " + JSON.stringify(room));
                Logger.log("New event: " + JSON.stringify(newEvent));
                try {
                    // Don't bother trying if the event won't allow additions
                    if (event.guestsCanInviteOthers) {
                        if (!dryRun) {
                            patchedEvent = Calendar.Events.patch(
                                newEvent,
                                'primary',
                                event.id,
                                {sendUpdates: 'none'},
                                {'If-Match': event.etag}
                            );
                            for (attendee of patchedEvent.attendees) {
                                if (attendee.email = room.resourceEmail) {
                                    roomAdded = true;
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    Logger.log('Patch threw an exception: ' + JSON.stringify(e));
                }

                if (roomAdded) {
                    Logger.log('Successfully added ' + room.generatedResourceName + ' to ' + event.summary);
                } else {
                    // TODO: create a new event with event.summary = roomHoldEventTitle and room, copy
                    // conferencing information.
                    Logger.log('Successfully added room hold of ' + room.generatedResourceName + ' for ' + event.summary);
                    roomAdded = true;
                }
                if (dryRun) Logger.log("(dry run, nothing modified)");

                // Don't clean up declined rooms here since we don't yet know if the
                // room we just added will accept or decline.

                break; // done searching for rooms
            }
            if (!roomAdded) {
                event.failureReason = "No available room found";
                failedEvents.push(event);
            }
        }
    }

    // Send failure summary to user
    if (failedEvents.length > 0) {
        var body = ['Room assistant was unable to find rooms for the following events:<br>'];
        for (event of failedEvents) {
            var start = new Date(event.start.dateTime);
            var startDate = start.toLocaleDateString();
            var startTime = start.toLocaleTimeString()
            var eventString = '<p style="margin-left: 40px"><a href=' + event.htmlLink + '>' + event.summary + '</a> on ' + startDate + ' at ' + startTime + '</p>';
            Logger.log('Event string: ' + eventString);
            body.push(eventString);
        }
        body.push('- Room Assistant');
        body = body.join('\n');
        MailApp.sendEmail({
            name: "Room Assistant",
            to: Session.getActiveUser().getEmail(),
            subject: "Room Assistant Failures",
            htmlBody: body,
            noReply: true
          });
    }
}
