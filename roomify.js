// Number of days to look ahead (1 = just today).
const lookahead = 1;

function runNow() {
  var cal = CalendarApp.getDefaultCalendar();
  var date = new Date();
  roomifyDate(cal, date);
  log('Room assistant running on \'' + cal.getName() + '\' for ' + date);
}

function log(s) {
  Logger.log(new Date() + ': ' + s);
}

function ensureRoomsInBuilding(date, building) {
  var events = getEvents(startOfDate(date), endOfDate(date));
  for (e in events) {
    var event = events[e];
    log('Checking event: ' + event.summary);
    
    if (event.start.date) {
      continue; // skip all day events (ones with a .date instead of a .dateTime)
    }
    var simpleEvent = CalendarApp.getEventById(event.id)
    if (simpleEvent == null) {
      throw ("Error getting simple event");
    }
    if (simpleEvent.getMyStatus == CalendarApp.GuestStatus.NO) {
      continue;
    }
  }
}

function testEnsureRoomsInBuilding() {
  initResources();
  // Which building?
  var buildingId = whereIsTheUserOrDie(today());
  ensureRoomsInBuilding(today(), buildingId);
}