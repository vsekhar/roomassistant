function listEvents() {
    var events = getEvents(startOfDate(today()), endOfDate(today()));
    for (e in events) {
      var event = events[e];
      if (event.start.date) {
        log('All day: ' + event.summary);
      } else {
        log('Regular: ' + event.summary);
      }
    }
  }
