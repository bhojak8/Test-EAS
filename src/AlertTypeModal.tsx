import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type AlertType = {
  id: string;
  label: string;
  color: string;
  emoji: string;
  category?: string;
  sound?: string;
};

const CATEGORIES = [
  "Fire & Safety",
  "Security",
  "Medical",
  "Natural Disasters",
  "Infrastructure",
  "Other",
];

const SOUNDS = [
  { id: "urgent", label: "Urgent Alarm", file: "/urgent-alarm.mp3" },
  { id: "siren", label: "Emergency Siren", file: "/alert.mp3" },
  { id: "bell", label: "Warning Bell", file: "/bell.mp3" },
];

export function AlertTypeModal({
  alertTypes,
  onSelect,
  onClose,
  isCreator,
  sessionId,
}: {
  alertTypes: AlertType[];
  onSelect: (type: string) => void;
  onClose: () => void;
  isCreator: boolean;
  sessionId: Id<"sessions">;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTypes, setEditedTypes] = useState(alertTypes);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const updateAlertTypes = useMutation(api.sessions.updateAlertTypes);
  const [volume, setVolume] = useState(0.5);

  const handleSave = async () => {
    try {
      await updateAlertTypes({
        sessionId,
        alertTypes: editedTypes,
      });
      toast.success("Alert types updated");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update alert types");
    }
  };

  const addNewType = () => {
    setEditedTypes([
      ...editedTypes,
      {
        id: `CUSTOM_${Date.now()}`,
        label: "New Alert Type",
        color: "bg-gray-600",
        emoji: "⚠️",
        category: "Other",
        sound: "siren",
      },
    ]);
  };

  const playSound = (sound: string) => {
    const audio = new Audio(SOUNDS.find(s => s.id === sound)?.file || "/alert.mp3");
    audio.volume = volume;
    audio.play().catch(console.error);
  };

  const filteredTypes = selectedCategory
    ? alertTypes.filter(t => t.category === selectedCategory)
    : alertTypes;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Select Alert Type</h2>
          {isCreator && (
            <button
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {isEditing ? "Save Changes" : "Edit Types"}
            </button>
          )}
        </div>

        {!isEditing && (
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-full whitespace-nowrap ${
                  selectedCategory === null
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                All Types
              </button>
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap ${
                    selectedCategory === category
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Alert Volume:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-32"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(isEditing ? editedTypes : filteredTypes).map((type, index) => (
            <div
              key={type.id}
              className={`p-4 rounded-lg ${
                isEditing ? "bg-gray-50" : type.color + " text-white"
              } ${!isEditing && "cursor-pointer hover:opacity-90"}`}
              onClick={() => {
                if (!isEditing) {
                  if (type.sound) {
                    playSound(type.sound);
                  }
                  onSelect(type.id);
                }
              }}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    value={type.label}
                    onChange={(e) => {
                      const newTypes = [...editedTypes];
                      newTypes[index] = { ...type, label: e.target.value };
                      setEditedTypes(newTypes);
                    }}
                    className="w-full p-2 border rounded"
                    placeholder="Alert type name"
                  />
                  <div className="flex gap-2">
                    <input
                      value={type.emoji}
                      onChange={(e) => {
                        const newTypes = [...editedTypes];
                        newTypes[index] = { ...type, emoji: e.target.value };
                        setEditedTypes(newTypes);
                      }}
                      className="w-20 p-2 border rounded"
                      placeholder="Emoji"
                    />
                    <select
                      value={type.category}
                      onChange={(e) => {
                        const newTypes = [...editedTypes];
                        newTypes[index] = { ...type, category: e.target.value };
                        setEditedTypes(newTypes);
                      }}
                      className="flex-1 p-2 border rounded"
                    >
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={type.color}
                      onChange={(e) => {
                        const newTypes = [...editedTypes];
                        newTypes[index] = { ...type, color: e.target.value };
                        setEditedTypes(newTypes);
                      }}
                      className="flex-1 p-2 border rounded"
                    >
                      <option value="bg-red-600">Red</option>
                      <option value="bg-orange-600">Orange</option>
                      <option value="bg-yellow-600">Yellow</option>
                      <option value="bg-green-600">Green</option>
                      <option value="bg-blue-600">Blue</option>
                      <option value="bg-purple-600">Purple</option>
                    </select>
                    <select
                      value={type.sound}
                      onChange={(e) => {
                        const newTypes = [...editedTypes];
                        newTypes[index] = { ...type, sound: e.target.value };
                        setEditedTypes(newTypes);
                        playSound(e.target.value);
                      }}
                      className="flex-1 p-2 border rounded"
                    >
                      {SOUNDS.map(sound => (
                        <option key={sound.id} value={sound.id}>
                          {sound.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      const newTypes = editedTypes.filter((_, i) => i !== index);
                      setEditedTypes(newTypes);
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">
                    {type.emoji} {type.label}
                  </div>
                  {type.category && (
                    <span className="text-sm bg-black/20 px-2 py-1 rounded">
                      {type.category}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {isEditing && (
            <button
              onClick={addNewType}
              className="w-full p-4 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600"
            >
              + Add New Alert Type
            </button>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
