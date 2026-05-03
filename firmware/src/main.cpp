/**
 * Custo Certo — Firmware ESP32 (Balança HX711)
 *
 * Lê o peso do amplificador HX711 e envia para o servidor a cada loop.
 * Também consulta se o servidor solicitou tara.
 *
 * CONFIGURAÇÃO:
 *  - WIFI_SSID / WIFI_PASS: credenciais da rede da cafeteria
 *  - SERVER_URL: URL do servidor (Render em produção, IP local em dev)
 *
 * Defina via build_flags no platformio.ini (preferido) ou edite os defines abaixo.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "HX711.h"

// =====================================================
// CONFIGURAÇÕES (sobrescreva via platformio.ini build_flags)
// =====================================================
#ifndef WIFI_SSID
#define WIFI_SSID "TSAI_2.4G"
#endif

#ifndef WIFI_PASS
#define WIFI_PASS "lucasstrinta"
#endif

#ifndef SERVER_URL
// DEV (rede local):  http://192.168.0.11:3000
// PROD (Render):     https://custo-certo.onrender.com
#define SERVER_URL "https://custo-certo.onrender.com"
#endif

// =====================================================
// PINOS DA BALANÇA
// =====================================================
#define HX711_DT  32
#define HX711_SCK 33

// Calibração — ajuste com peso conhecido
#define SCALE_FACTOR 297313.0f

// =====================================================
// CONSTANTES DE TEMPO
// =====================================================
const unsigned long INTERVALO_LEITURA_MS = 200;     // envia peso 5x/s
const unsigned long INTERVALO_TARA_MS    = 1000;    // checa tara 1x/s
const unsigned long WIFI_TIMEOUT_MS      = 20000;

// =====================================================
// ESTADO GLOBAL
// =====================================================
HX711 scale;
unsigned long ultimaLeitura = 0;
unsigned long ultimaCheckTara = 0;

bool serverIsHttps() {
  return String(SERVER_URL).startsWith("https://");
}

// =====================================================
// CONEXÃO WI-FI
// =====================================================
void conectarWiFi() {
  Serial.print("📶 Conectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - inicio > WIFI_TIMEOUT_MS) {
      Serial.println("\n❌ Falha ao conectar — reiniciando...");
      ESP.restart();
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("✅ Wi-Fi OK | IP: ");
  Serial.println(WiFi.localIP());
}

// =====================================================
// HTTP HELPERS
// =====================================================
// Para HTTPS sem certificado raiz embarcado, usamos setInsecure().
// Em produção crítica recomenda-se subir a CA do Render para o ESP32.
bool httpPost(const String& path, const String& body) {
  HTTPClient http;
  WiFiClientSecure clientSecure;
  WiFiClient clientPlain;

  bool ok;
  if (serverIsHttps()) {
    clientSecure.setInsecure();
    ok = http.begin(clientSecure, String(SERVER_URL) + path);
  } else {
    ok = http.begin(clientPlain, String(SERVER_URL) + path);
  }

  if (!ok) {
    Serial.println("❌ http.begin falhou");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  int code = http.POST(body);
  bool sucesso = (code >= 200 && code < 300);

  if (!sucesso) {
    Serial.printf("⚠️  POST %s -> %d\n", path.c_str(), code);
  }

  http.end();
  return sucesso;
}

String httpGet(const String& path) {
  HTTPClient http;
  WiFiClientSecure clientSecure;
  WiFiClient clientPlain;

  bool ok;
  if (serverIsHttps()) {
    clientSecure.setInsecure();
    ok = http.begin(clientSecure, String(SERVER_URL) + path);
  } else {
    ok = http.begin(clientPlain, String(SERVER_URL) + path);
  }

  if (!ok) return "";

  http.setTimeout(5000);
  int code = http.GET();
  String resp = "";
  if (code == 200) {
    resp = http.getString();
  } else {
    Serial.printf("⚠️  GET %s -> %d\n", path.c_str(), code);
  }
  http.end();
  return resp;
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Custo Certo - Balança ===");

  conectarWiFi();

  Serial.print("⚖️  Iniciando HX711 nos pinos DT=");
  Serial.print(HX711_DT);
  Serial.print(" SCK=");
  Serial.println(HX711_SCK);

  scale.begin(HX711_DT, HX711_SCK);
  scale.set_scale(SCALE_FACTOR);
  scale.tare();

  Serial.println("✅ Balança calibrada e pronta");
  Serial.print("🌐 Servidor: ");
  Serial.println(SERVER_URL);
}

// =====================================================
// LOOP
// =====================================================
void loop() {
  // Reconecta se WiFi cair
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  Wi-Fi caiu — reconectando...");
    conectarWiFi();
  }

  unsigned long agora = millis();

  // ----- ENVIAR PESO -----
  if (agora - ultimaLeitura >= INTERVALO_LEITURA_MS) {
    ultimaLeitura = agora;

    float peso = scale.get_units(1);
    if (peso < 0) peso = 0;

    char body[64];
    snprintf(body, sizeof(body), "{\"peso\":%.3f}", peso);
    httpPost("/balanca/peso", body);

    // Log opcional (descomente para debug)
    // Serial.printf("Peso: %.3f kg\n", peso);
  }

  // ----- CHECAR TARA -----
  if (agora - ultimaCheckTara >= INTERVALO_TARA_MS) {
    ultimaCheckTara = agora;

    String resp = httpGet("/balanca/tara");
    if (resp.indexOf("\"tarar\":true") >= 0) {
      scale.tare();
      Serial.println("✅ Tara executada");
    }
  }

  delay(10);
}