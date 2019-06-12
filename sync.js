function doSync({fullSync = false} = {}) {
    var events = getSyncEvents({fullSync: fullSync});
    Logger.log("Syncing :", events.length, " events");

    // Index events by date
    var eventsByDate = {};
    for (e in events) {
        var event = events[e];
        var date;
        if (event.start.date) {
            date = new Date(event.start.date);
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
    for (d in eventsByDate) {
        var events = eventsByDate[d];
        Logger.log("Events on ", d, ": ", events);
        var building = buildingFromEvents(events);
        if (building == null) {
            building = buildingFromDirectoryOrDie();
        }
        Logger.log("User is in ", building, " on ", d);
    }
}
