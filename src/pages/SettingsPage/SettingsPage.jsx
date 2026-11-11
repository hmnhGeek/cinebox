import { useState } from "react";
import cineToast from "../../components/CineToast/CineToast";
import { useSettings } from "../../context/SettingsContext";
import "./SettingsPage.css";

function SettingRow({ title, description, checked, disabled, onChange }) {
  return (
    <div className="settings-row">
      <div className="settings-row-content">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className={`settings-switch${checked ? " is-enabled" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-switch-thumb" />
      </button>
    </div>
  );
}

function SettingsSection({ title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="settings-section-content">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { settings, loading, error, retryLoadSettings, updateSettings } =
    useSettings();

  const [savingKeys, setSavingKeys] = useState(() => new Set());

  const handleSettingChange = async (key, value) => {
    if (savingKeys.has(key)) return;

    setSavingKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });

    try {
      await updateSettings({
        [key]: value,
      });
    } catch (err) {
      console.error(`Failed to update setting "${key}":`, err);

      cineToast.error(
        err?.message || "Couldn't save this setting. Please try again.",
      );
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRetry = async () => {
    try {
      await retryLoadSettings();
    } catch {
      // The context updates its error state.
    }
  };

  if (loading) {
    return (
      <main className="settings-page">
        <div className="settings-container">
          <div className="settings-page-header">
            <span className="settings-eyebrow">CINEBOX PREFERENCES</span>
            <h1>Settings</h1>
            <p>Fine-tune your personal cinema experience.</p>
          </div>

          <div className="settings-loading" role="status">
            <span className="settings-loading-spinner" />
            <span>Loading preferences...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="settings-page">
        <div className="settings-container">
          <div className="settings-page-header">
            <span className="settings-eyebrow">CINEBOX PREFERENCES</span>
            <h1>Settings</h1>
            <p>Fine-tune your personal cinema experience.</p>
          </div>

          <div className="settings-error" role="alert">
            <p>Settings are temporarily unavailable.</p>
            <span>{error}</span>

            <button
              type="button"
              className="settings-retry-button"
              onClick={handleRetry}
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const defaultMuted = settings?.playback?.defaultMuted ?? true;

  const showOnlyActorsWithProfile =
    settings?.discovery?.actors?.showOnlyWithProfile ?? false;

  const expandTechnicalInfo = settings?.library?.expandTechnicalInfo ?? false;

  return (
    <main className="settings-page">
      <div className="settings-container">
        <header className="settings-page-header">
          <span className="settings-eyebrow">CINEBOX PREFERENCES</span>
          <h1>Settings</h1>
          <p>Fine-tune your personal cinema experience.</p>
        </header>

        <div className="settings-sections">
          <SettingsSection
            title="Playback"
            description="Control how your videos start and play."
          >
            <SettingRow
              title="Default muted playback"
              description="Start every new playback session without audio."
              checked={defaultMuted}
              disabled={savingKeys.has("playback.defaultMuted")}
              onChange={(value) =>
                handleSettingChange("playback.defaultMuted", value)
              }
            />
          </SettingsSection>

          <SettingsSection
            title="Discovery"
            description="Personalise how people appear in your library."
          >
            <SettingRow
              title="Show actors with profile images only"
              description="Make actors with an available profile image the default view in the Actors directory."
              checked={showOnlyActorsWithProfile}
              disabled={savingKeys.has("discovery.actors.showOnlyWithProfile")}
              onChange={(value) =>
                handleSettingChange(
                  "discovery.actors.showOnlyWithProfile",
                  value,
                )
              }
            />
          </SettingsSection>

          <SettingsSection
            title="Library"
            description="Customise the information presented on movie pages."
          >
            <SettingRow
              title="Expand technical information by default"
              description="Automatically open the technical specifications section when viewing a movie."
              checked={expandTechnicalInfo}
              disabled={savingKeys.has("library.expandTechnicalInfo")}
              onChange={(value) =>
                handleSettingChange("library.expandTechnicalInfo", value)
              }
            />
          </SettingsSection>
        </div>
      </div>
    </main>
  );
}

export default SettingsPage;
