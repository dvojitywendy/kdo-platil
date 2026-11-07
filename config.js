// Kde leží spis. Repozitář má být SOUKROMÝ a oddělený od appky (postup je v README.md).
// Přístupový klíč sem nepatří: každý ho vloží jednou do appky a zůstane jen v jeho telefonu.
// Když je dataRepo prázdné, appka běží jen lokálně v jednom zařízení.
//
// vapidPublicKey je veřejná polovina klíče pro upozornění. Soukromá polovina patří jen
// do tajemství VAPID_PRIVATE_KEY v datovém repu (Settings → Secrets and variables → Actions).
window.KDO_PLATIL_CONFIG = {
  dataRepo: "dvojitywendy/kdo-platil-data",
  dataPath: "spis.json",
  vapidPublicKey: "BKdHSKEhS7THUt5X3u2E08QrKImtFtBXg10wG1cZ7iO1ajMpTQz7B7rsdA22LH3EHwKp7ixBnHsiDkH4qaoweTY",
  // Kdo z vás je pořád v korporátu ("a" nebo "b"). Ten druhý je ten, kdo utekl. Řídí korporátní hlášky.
  corporatePerson: "b"
};
