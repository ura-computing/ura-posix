import { useI18n } from "@/i18n/I18nProvider";
import { LANGS, LANG_LABELS } from "@/i18n/config";
import { cn } from "@/utils/cn";


/** FR / ES segmented switch — mirrors ThemeToggle, sits next to it in the Header. */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-[9px] border border-border bg-surface-subtle p-0.5" aria-label={t("lang.label")}>
      {LANGS.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-label={t(`lang.${l}`)}
            aria-pressed={active}
            className={cn(
              "flex h-7 w-[30px] cursor-pointer items-center justify-center rounded-md text-[11px] font-bold transition-colors",
              active
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LANG_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
