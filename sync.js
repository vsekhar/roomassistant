function doSync({fullSync = false} = {}) {
    var events = getSyncEvents({fullSync: fullSync});
    Logger.log("Syncing :", events.length, " events");

    // Index events by date
    var eventsByDate = {};
    for (event of events) {
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
        var roomsByEmail = {};
        for (room of rooms) {
          roomsByEmail[room.resourceEmail] = room;
        }
      
        // Loop through events
        for (event of events) {
            if (event.start.date) continue; // skip all-day events

            var roomRequested = event.summary.toLowerCase().includes('room');
            var hasAttendees = event.attendees && event.attendees.length > 0;
            var numAttendees = hasAttendees ? event.attendees.length : 0;

            // numAttendees == 
            //   0: just the user (no guests, no rooms)
            //   1: attendee list too large to display (e.g. all-hands)
            //       - event.attendeesOmitted doesn't work to detect big meetings
            //   2: event has one other guest or a room, plus the user
            //       - Yes, adding *just* a room to an empty event bumps
            //         numAttendees from 0 to 2...
            if (!roomRequested) {
                if (numAttendees == 0) continue; // skip non-meetings
                if (numAttendees == 1) continue; // skip all-hands
            }

            var humans = 0;
            var userDeclined = false;
            var hasRoom = false;
            for (attendee of event.attendees) {
                if (attendee.self && attendee.responseStatus == 'declined') userDeclined = true;
                if (attendee.resource && attendee.responseStatus == 'accepted' && roomsByEmail.hasOwnProperty(attendee.email)) hasRoom = true;
                if (!attendee.resource) humans++;
            }
            if (hasRoom) continue;
            if (userDeclined) continue;
            if (!roomRequested) {
                if (humans == 0) throw new Error("Event has attendees but no humans"); // unexpected
                if (humans == 1) continue; // skip non-meetings
            }

            Logger.log("ROOMIFYING: " + event.summary + "' (" + humans + " humans, " + numAttendees + " attendees) on " + dateString);
            if (debug && !event.summary.toLowerCase().includes('test')) {
                Logger.log("DEBUG: skipping (event title doesn't include 'test')");
                continue;
            }

            var roomGen = availableRoomGenerator(rooms, event.start.dateTime, event.end.dateTime);
            var foundRoom = false;
            roomLoop:
            for (room of roomGen) {
                for (attendee of event.attendees) {
                    if (!attendee.resource) continue;
                    if (attendee.email === room.email && attendee.responseStatus == 'declined') {
                        continue roomLoop;
                    }
                }
                Logger.log("ADD: " + room.generatedResourceName + " to '" + event.summary + "' (" + humans + " humans, " + numAttendees + " attendees) on " + dateString);
                addRoom(event, room);
                // TODO: loop?
                foundRoom = true;
                break;
            }
            if (!foundRoom) {
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
