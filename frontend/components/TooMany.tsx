import { getTranslations } from "next-intl/server";
import { Msg } from "@/components/Msg";

// Das Backend hat das Ratenlimit gemeldet (429): eine ruhige Meldung statt der Fehlerseite. Nichts ist kaputt, es hilft nur Warten.
export async function TooMany() {
  const t = await getTranslations("common");
  return (
    <main id="main">
      <Msg kind="info">{t("tooMany")}</Msg>
    </main>
  );
}
