const schemas = {
  AutoToggleEvent: require('./schema/AutoToggleEvent'),
  CreateElementEvent: require('./schema/CreateElementEvent'),
  CreateElementRequest: require('./schema/CreateElementRequest'),
  CreateElementResponse: require('./schema/CreateElementResponse'),
  DeleteElementEvent: require('./schema/DeleteElementEvent'),
  DeleteElementRequest: require('./schema/DeleteElementRequest'),
  DeleteElementResponse: require('./schema/DeleteElementResponse'),
  ElementExpirationType: require('./schema/ElementExpirationType'),
  ForfeitElementEvent: require('./schema/ForfeitElementEvent'),
  LoginRequest: require('./schema/LoginRequest'),
  LoginResponse: require('./schema/LoginResponse'),
  NotificationEvent: require('./schema/NotificationEvent'),
  OwnElementRequest: require('./schema/OwnElementRequest'),
  OwnElementResponse: require('./schema/OwnElementResponse'),
  PingRequest: require('./schema/PingRequest'),
  PingResponse: require('./schema/PingResponse'),
  RoomEvent: require('./schema/RoomEvent'),
  RoomRequest: require('./schema/RoomRequest'),
  RoomResponse: require('./schema/RoomResponse'),
  SceneDiffEvent: require('./schema/SceneDiffEvent'),
  SceneMapUpdateEvent: require('./schema/SceneMapUpdateEvent'),
  UpdateElementBoolEvent: require('./schema/UpdateElementBoolEvent'),
  UpdateElementCol4Event: require('./schema/UpdateElementCol4Event'),
  UpdateElementEvent: require('./schema/UpdateElementEvent'),
  UpdateElementFloatEvent: require('./schema/UpdateElementFloatEvent'),
  UpdateElementIntEvent: require('./schema/UpdateElementIntEvent'),
  UpdateElementStringEvent: require('./schema/UpdateElementStringEvent'),
  UpdateElementVec3Event: require('./schema/UpdateElementVec3Event')
};

const schemaMap = require('./schema/schemaMap');

module.exports = {
  schemas,
  schemaMap
}
