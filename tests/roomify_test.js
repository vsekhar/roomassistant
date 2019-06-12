function testEnsureRoomsForDate() {
    initResources();
    // Which building?
    var buildingId = whereIsTheUserOrDie(today());
    ensureRoomsForDate(today(), buildingId);
  }
  