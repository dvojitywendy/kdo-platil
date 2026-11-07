// Kde leží spis. Repozitář má být SOUKROMÝ a oddělený od appky (postup je v README.md).
// Přístupový klíč sem nepatří: každý ho vloží jednou do appky a zůstane jen v jeho telefonu.
// Když je dataRepo prázdné, appka běží jen lokálně v jednom zařízení.
//
// vapidPublicKey je veřejná polovina klíče pro upozornění. Soukromá polovina patří jen
// do tajemství VAPID_PRIVATE_KEY v datovém repu (Settings → Secrets and variables → Actions).
window.KDO_PLATIL_CONFIG = {
  dataRepo: "dvojitywendy/kdo-platil-data",
  dataPath: "spis.json",
  vapidPublicKey: "BCb3-1nndv-geN6xMobvV2_4latyB2pdRFqIlog7pN6xYVAcVl7BpL_tSx-8noe5OX8YkFUh_kbR1U-aBo0CQpk"
};
