import { useState, useRef } from "react";
import { Check, Upload, X, Bot } from "lucide-react";
import { COLOR_PRESETS, ColorPreset } from "@/lib/color_presets";

interface BrandingPickerProps {
  primary: string;
  secondary: string;
  avatarPreview: string | null;
  onColorChange: (primary: string, secondary: string) => void;
  onAvatarChange: (file: File | null, preview: string | null) => void;
}

export default function BrandingPicker({
  primary,
  secondary,
  avatarPreview,
  onColorChange,
  onAvatarChange,
}: BrandingPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customPrimary, setCustomPrimary] = useState(primary);
  const [customSecondary, setCustomSecondary] = useState(secondary);
  const fileRef = useRef<HTMLInputElement>(null);

  const isPresetSelected = (p: ColorPreset) =>
    p.primary === primary && p.secondary === secondary;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Avatar must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      onAvatarChange(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    onAvatarChange(null, null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCustomApply = () => {
    onColorChange(customPrimary, customSecondary);
    setShowCustom(false);
  };

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div>
        <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Avatar</label>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ backgroundColor: primary + "30", border: `2px solid ${primary}40` }}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-7 h-7" style={{ color: primary }} />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110"
              style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image
            </button>
            {avatarPreview && (
              <button
                onClick={handleRemoveAvatar}
                className="flex items-center gap-1 text-xs cursor-pointer"
                style={{ color: "#ef4444", opacity: 0.7 }}
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Color Theme */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm" style={{ color: "#D3DAD9", opacity: 0.7 }}>Color Theme</label>
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="text-xs cursor-pointer transition-all"
            style={{ color: "#D3DAD9", opacity: 0.4 }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
          >
            {showCustom ? "Show presets" : "Custom colors"}
          </button>
        </div>

        {showCustom ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs mb-1" style={{ color: "#D3DAD9", opacity: 0.5 }}>Primary</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                    style={{ backgroundColor: "transparent" }}
                  />
                  <input
                    type="text"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg outline-none text-xs uppercase"
                    style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs mb-1" style={{ color: "#D3DAD9", opacity: 0.5 }}>Secondary</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customSecondary}
                    onChange={(e) => setCustomSecondary(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                    style={{ backgroundColor: "transparent" }}
                  />
                  <input
                    type="text"
                    value={customSecondary}
                    onChange={(e) => setCustomSecondary(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg outline-none text-xs uppercase"
                    style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                  />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-10 rounded-lg flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: customSecondary, color: customPrimary, border: `1px solid ${customPrimary}40` }}
              >
                Preview Message
              </div>
              <button
                onClick={handleCustomApply}
                className="px-4 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: customPrimary, color: "#ffffff" }}
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onColorChange(preset.primary, preset.secondary)}
                className="relative flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all hover:brightness-110"
                style={{
                  backgroundColor: isPresetSelected(preset) ? preset.secondary : "#37353E",
                  border: isPresetSelected(preset) ? `2px solid ${preset.primary}` : "2px solid transparent",
                }}
                title={preset.name}
              >
                {isPresetSelected(preset) && (
                  <div
                    className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: preset.primary }}
                  >
                    <Check className="w-2 h-2" style={{ color: "#ffffff" }} />
                  </div>
                )}
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.primary }} />
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.secondary, border: "1px solid #ffffff15" }} />
                </div>
                <span className="text-[9px]" style={{ color: "#D3DAD9", opacity: 0.5 }}>{preset.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}