const DeviceParser = require('./DeviceParser');
const AccessoryParser = require('./AccessoryParser');

// 将门磁传感器（接触传感器 Contact Sensor）模拟成动作传感器（Motion Sensor）
// 这可以在家庭应用的自动化中提供“开启”和“关闭”两个自动化触发状态
// 默认的接触传感器只能提供”关闭“一个触发器
class ContactSensorParser extends DeviceParser {
    constructor(model, platform) {
        super(model, platform);
    }
    
    getAccessoriesParserInfo() {
        // 与真正的动作传感器区分
        return {
            'ContactSensor_MotionDetected': ContactSensorContactSensorParser
        }
    }
}

// 支持的设备：门磁感应
ContactSensorParser.modelName = ['magnet', 'sensor_magnet', 'sensor_magnet.aq2'];
module.exports = ContactSensorParser;

class ContactSensorContactSensorParser extends AccessoryParser {
    constructor(model, platform, accessoryType) {
        super(model, platform, accessoryType)
    }
    
    getAccessoryCategory(deviceSid) {
        return this.Accessory.Categories.SENSOR;
    }
    
    getAccessoryInformation(deviceSid) {
        return {
            'Manufacturer': 'Aqara',
            'Model': 'Motion Sensor',
            'SerialNumber': deviceSid
        };
    }

    getServices(jsonObj, accessoryName) {
        var that = this;
        var result = [];
        
        var service = new that.Service.MotionSensor(accessoryName);
        service.getCharacteristic(that.Characteristic.MotionDetected);
        result.push(service);
        
        var batteryService  = new that.Service.BatteryService(accessoryName);
        batteryService.getCharacteristic(that.Characteristic.StatusLowBattery);
        batteryService.getCharacteristic(that.Characteristic.BatteryLevel);
        batteryService.getCharacteristic(that.Characteristic.ChargingState);
        result.push(batteryService);
        
        return result;
    }
    
    parserAccessories(jsonObj) {
        var that = this;
        var deviceSid = jsonObj['sid'];
        var uuid = that.getAccessoryUUID(deviceSid);
        var accessory = that.platform.AccessoryUtil.getByUUID(uuid);
        if(accessory) {
            var service = accessory.getService(that.Service.MotionSensor);
            var contactSensorStateCharacteristic = service.getCharacteristic(that.Characteristic.MotionDetected);
            var value = that.getContactSensorStateCharacteristicValue(jsonObj, null);
            if(null != value) {
                contactSensorStateCharacteristic.updateValue(value ? false : true);
            }
            
            if(that.platform.ConfigUtil.getAccessorySyncValue(deviceSid, that.accessoryType)) {
                if (contactSensorStateCharacteristic.listeners('get').length == 0) {
                    contactSensorStateCharacteristic.on("get", function(callback) {
                        var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
                        that.platform.sendReadCommand(deviceSid, command).then(result => {
                            var value = that.getContactSensorStateCharacteristicValue(result, null);
                            if(null != value) {
                                callback(null, value ? false : true);
                            } else {
                                callback(new Error('get value fail: ' + result));
                            }
                        }).catch(function(err) {
                            that.platform.log.error(err);
                            callback(err);
                        });
                    });
                }
            }
            
            that.parserBatteryService(accessory, jsonObj);
        }
    }
    
    // false 意味着没有动作（关闭状态）
    // true 意味着开启状态（未接触）
    getContactSensorStateCharacteristicValue(jsonObj, defaultValue) {
        var value = this.getValueFrJsonObjData(jsonObj, 'status');
        return (null != value) ? (value === 'close') : defaultValue;
    }
}
