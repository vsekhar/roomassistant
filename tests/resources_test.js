function testBuildingId() {
    initResources();
    if (buildingId('abc123') != null) {
      Logger.log("ERROR: Non-existant building found");
    }
    if (buildingId('CA-WAT-BRT2') != 'CA-WAT-BRT2') {
      Logger.log("ERROR: CA-WAT-BRT2 not found");
    }
    if (buildingId('WAT-BRT2') != 'CA-WAT-BRT2') {
      Logger.log("ERROR: WAT-BRT2 not found (got: " + buildingId('WAT-BRT2') + ", want: " + 'CA-WAT-BRT2');
    }
    Logger.log("Done");
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
      Logger.log('testCalendarBuildingOverride (' + (i+1) + '/3): ' + locationFromEvents(events));
    }
  }
  
  function testWhereIsTheUserOrDie() {
    initResources();
    var building = whereIsTheUserOrDie(today());
    Logger.log('Building: ' + building);
  }
  
  function testRoomsIn() {
    const building = 'US-NYC-9TH'
    var rooms = roomsIn(building);
    Logger.log('Rooms in ' + building + ': ' + rooms.length);
  }

  function testAvailableRoomGenerator() {
    var rooms = [
      {
        // US-NYC-9TH-10-B-Hal 9000
        resourceEmail: 'google.com_726f6f6d5f75735f6e79635f3974685f31305f313062323038@resource.calendar.google.com'
      }
    ];
    var startTime = '2019-06-12T01:00:00-05:00';
    var endTime = '2019-06-12T02:00:00-05:00';
    var roomGen = availableRoomGenerator(rooms, startTime, endTime);
    roomGen.next();
    var avail = roomGen.next();
    Logger.log("Room available: " + JSON.stringify(avail));
  }
