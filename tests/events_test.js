function listEvents() {
    var events = getEvents(startOfDate(today()), endOfDate(today()));
    for (e in events) {
      var event = events[e];
      if (event.start.date) {
        Logger.log('All day: ' + event.summary);
      } else {
        Logger.log('Regular: ' + event.summary);
      }
    }
  }
