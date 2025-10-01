#ifndef _SMARTBEE_CONFIG_H
#define _SMARTBEE_CONFIG_H

#define SMARTBEE_MQTT_TLS 8885 // Usar en producción: puerta para MQTT sobre TLS
#define SMARTBEE_MQTT_WSS 443  // Usar desde el IPST: puerta para MQTT con websocket sobre TLS
#define SMARTBEE_MQTT_NML 1883 // Usar contra servidor local: puerta para MQTT local

// --- INICIO CONFIGURACION ---
#define SMARTBEE_MQTT_SERVER "smartbee.cl"   // direccion IP del servidor MQTT (o websocket)
#define SMARTBEE_MQTT_PORT SMARTBEE_MQTT_TLS // seleccionar SMARTBEE_MQTT_NML, SMARTBEE_MQTT_TLS o SMARTBEE_MQTT_WSS
#define SMARTBEE_WIFI_SSID "Colmena"         // Nombre de la wifi
#define SMARTBEE_WIFI_PASS "@Abejita123"      // Clave de la wifi
#define SMARTBEE_MQTT_NODE "NODO-B5B3ABC4-E0CE-4662-ACB3-7A631C12394A"         // ID del nodo autorizado a publicar
#define SMARTBEE_MQTT_PASS "eeheeut4Ph0oocer65"      // Clavel del nodo autorizado para publicar
#define SMARTBEE_LOADCELL_ENABLED 0          // establece si se incluye o no el modulo de peso. 0 = no, 1= si
#define SMARTBEE_LOADCELL_CALIBRATION 2280.f // resultado de la calibración
// --- FIN CONFIGURACION ---

#define SMARTBEE_MQTT_CLIENTID SMARTBEE_MQTT_NODE                        // id unico de este nodo
#define SMARTBEE_MQTT_TOPIC "SmartBee/nodes/" SMARTBEE_MQTT_NODE "/data" // topico en donde publicar
#define SMARTBEE_MQTT_WSS_PATH "/apps/mqtt.rcr"                          // ruta para acceder a MQTT via websocket
#define SMARTBEE_SLEEP_US_NORMAL (20 * 60 * 1000000)                     // deep sleep normal cada 20 minutos
#define SMARTBEE_SLEEP_US_ERROR (5 * 60 * 1000000)                       // deep sleep ante error cada 5 minutos
#define SMARTBEE_SLEEP_US_DEBUG (10 * 60 * 1000000)                       // deep sleep al depurar cada 1 minuto
#define SMARTBEE_DHT_PIN_DATA 13                                         // pin de conexion para la lectura del DHT22
#define SMARTBEE_LOADCELL_DOUT_PIN 16                                    // pin de lectura de la data
#define SMARTBEE_LOADCELL_SCK_PIN 17                                     // pin del reloj
#define SMARTBEE_LOADCELL_CHANNEL_A 128                                  // con este factor de ganacia se seleciona el canal A
#define SMARTBEE_LOADCELL_CHANNEL_B 32                                   // con este factor de ganacia se seleciona el canal B

#endif // _SMARTBEE_CONFIG_H
