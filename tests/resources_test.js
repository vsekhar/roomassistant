function testBuildingId() {
    initResources();
    if (buildingId('abc123') != null) {
      log("ERROR: Non-existant building found");
    }
    if (buildingId('CA-WAT-BRT2') != 'CA-WAT-BRT2') {
      log("ERROR: CA-WAT-BRT2 not found");
    }
    if (buildingId('WAT-BRT2') != 'CA-WAT-BRT2') {
      log("ERROR: WAT-BRT2 not found (got: " + buildingId('WAT-BRT2') + ", want: " + 'CA-WAT-BRT2');
    }
    log("Done");
  }
  
  function testCalendarBuildingOverride() {
    // Ensure there are three all-day events over the next three days:
    //   1. Building ID ("CA-WAT-BRT2")
    //   2. Building name ("WAT-BRT2")
    //   3. "OOO"
    //   4. "WFH"
    
    initResources();
    var date = new Date();
    var cal = CalendarApp.getDefaultCalendar();
    for (var i = 0; i < 4; i++) {
      var d = new Date(date);
      d.setDate(d.getDate() + i);
      var events = getEvents(startOfDate(d), endOfDate(d));
      log('testCalendarBuildingOverride (' + (i+1) + '/3): ' + locationFromEvents(events));
    }
  }
  
  function testWhereIsTheUserOrDie() {
    initResources();
    var building = whereIsTheUserOrDie(today());
    log('Building: ' + building);
  }
  