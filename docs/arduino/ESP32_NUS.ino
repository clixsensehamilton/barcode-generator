// ESP32 Nordic UART Service (NUS) — Barcode Generator Extension
//
// Advertises as "EB The Best" over BLE.
// The Chrome extension connects and sends plain-text values via the NUS TX characteristic.
// Received values are printed to Serial and can be acted on in onWrite().
//
// Board:   ESP32 Dev Module (Tools > Board > esp32 > ESP32 Dev Module)
// Port:    Select the COM port showing CH340
// Baud:    9600

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define DEVICE_NAME  "EB The Best"
#define NUS_SERVICE  "6e400001-b5b4-f393-e0a9-e50e24dcca9e"
#define NUS_TX_CHAR  "6e400002-b5b4-f393-e0a9-e50e24dcca9e"  // extension writes here
#define NUS_RX_CHAR  "6e400003-b5b4-f393-e0a9-e50e24dcca9e"  // ESP32 notifies here

BLECharacteristic *rxChar;
bool deviceConnected = false;

// -------------------------------------------------------------------
// Connection state callbacks
// -------------------------------------------------------------------
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) {
    deviceConnected = true;
    Serial.println("[BLE] Client connected");
  }
  void onDisconnect(BLEServer *server) {
    deviceConnected = false;
    Serial.println("[BLE] Client disconnected — restarting advertising");
    BLEDevice::getAdvertising()->start();
  }
};

// -------------------------------------------------------------------
// Data received from the extension (NUS TX characteristic)
// -------------------------------------------------------------------
class TxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) {
    String val = c->getValue().c_str();
    if (val.length() == 0) return;

    Serial.println(val);

    // ----------------------------------------------------------------
    // TODO: act on the received value here.
    // Examples:
    //   float f = val.toFloat();   // parse as number
    //   digitalWrite(LED_BUILTIN, val == "1" ? HIGH : LOW);
    // ----------------------------------------------------------------

    // Echo the value back to the extension via the RX characteristic
    if (deviceConnected) {
      rxChar->setValue(val.c_str());
      rxChar->notify();
    }
  }
};

// -------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------
void setup() {
  Serial.begin(9600);
  Serial.println("[BLE] Initialising...");

  BLEDevice::init(DEVICE_NAME);

  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *service = server->createService(NUS_SERVICE);

  // TX char — extension writes values to this
  BLECharacteristic *txChar = service->createCharacteristic(
    NUS_TX_CHAR,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  txChar->setCallbacks(new TxCallbacks());

  // RX char — ESP32 sends notifications to the extension via this
  rxChar = service->createCharacteristic(
    NUS_RX_CHAR,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  rxChar->addDescriptor(new BLE2902());

  service->start();

  // Put the NUS service UUID in the primary advertisement packet so
  // Web Bluetooth service-UUID filters can find the device.
  BLEAdvertisementData advData;
  advData.setCompleteServices(BLEUUID(NUS_SERVICE));
  BLEAdvertisementData scanData;
  scanData.setName(DEVICE_NAME);

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->setAdvertisementData(advData);
  adv->setScanResponseData(scanData);
  adv->start();

  Serial.println("[BLE] Advertising as: " DEVICE_NAME);
}

// -------------------------------------------------------------------
// Loop
// -------------------------------------------------------------------
void loop() {
  // Add your main logic here.
  // Keep loops short — avoid long delay() calls while BLE is active.
  delay(100);
}
