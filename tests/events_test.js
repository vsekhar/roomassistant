function listEvents() {
    var events = getEvents(startOfDate(today()), endOfDate(today()));
    for (event of events) {
      if (event.start.date) {
        Logger.log('All day: ' + event.summary);
      } else {
        Logger.log('Regular: ' + event.summary);
      }
    }
  }
