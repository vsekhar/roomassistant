function testEnsureRoomsInBuilding() {
    initResources();
    // Which building?
    var buildingId = whereIsTheUserOrDie(today());
    ensureRoomsInBuilding(today(), buildingId);
  }
  