// Returns events for a calendar on a date (updated every 10 seconds).
function getEvents(startDate, endDate) {
  // Maybe use a cache
  var cal = CalendarApp.getDefaultCalendar();
  var events = Calendar.Events.list(cal.getId(), {
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,  // blow up recurring events into single events
    orderBy: 'startTime',
    maxResults: 1000 // max 2500
  });
  return events.items;
}
