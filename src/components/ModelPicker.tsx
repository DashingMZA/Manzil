"use client";

import { useI18n } from "@/components/I18nProvider";
import { MODEL_CATALOG, groupModels } from "@/lib/models";

export function ModelPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const { t } = useI18n();
  const groups = groupModels(MODEL_CATALOG);
  const known = MODEL_CATALOG.some((m) => m.id === value);

  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {!value ? <option value="">{t("modelPicker.selectPlaceholder")}</option> : null}

      {/* Purane build se save hua koi model jo ab catalog mein nahi hai —
          select se gayab na ho jaye, is liye alag group mein dikhate hain. */}
      {value && !known ? (
        <optgroup label={t("modelPicker.savedGroup")}>
          <option value={value}>{value}</option>
        </optgroup>
      ) : null}

      {groups.map((group) => (
        <optgroup key={group.name} label={group.name}>
          {group.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
