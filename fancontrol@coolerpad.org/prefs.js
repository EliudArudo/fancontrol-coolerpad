const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const {
    readFile,
    writeFile,
    validateJSON,
    setTimeout,
    defaultValues
} = Me.imports.utils;

const settingsFile = Gio.File.new_for_path(Me.path + '/.config/settings.json');

const MyPrefsWidget = GObject.registerClass(
    class MyPrefsWidget extends Gtk.Box {
        _init(params) {
            super._init(params);

            this.margin = 20;
            this.set_spacing(15);
            this.set_orientation(Gtk.Orientation.VERTICAL);

            this._settings = null;
            this.DEFAULT_MESSAGE_LABEL = "";
       
            this._updateTimeBox = null;
            this._fanSpeedThresholdBox = null;
            this._gpuTempThresholdBox = null;
            this._usbHubSettingsTitleBox = null;
            this._usbHubBox = null;
            this._usbPortBox = null;
            this._messageBox = null;
            this._defaultStateBox = null;

            this._updateTimeSpinButton = null;
            this._fanSpeedThresholdInput = null;
            this._gpuTempThresholdInput = null;
            this._usbHubInput = null;
            this._usbPortInput = null;
            this._combobox = null;
            this._comboboxModel = null;
            this._messageLabel = null;
            this._saveSettingsButton = null;

            this._updateTimeSpinButtonId = null;
            this._fanSpeedThresholdInputId = null;
            this._gpuTempThresholdInputId = null;
            this._usbHubInputId = null;
            this._usbPortInputId = null;
            this._comboboxId = null;
            this._saveSettingsButtonId = null;

            this._updateTimeSpinButtonValue = null;
            this._fanSpeedThresholdInputValue = null;
            this._gpuTempThresholdInputValue = null;
            this._usbHubInputValue = null;
            this._usbPortInputValue = null;
            this._comboboxValue = null;
            
            this._setInputItems();
            this._setComboBox();
            this._addItems();
            this._addSavingsButton();
            this._addEventListeners();

            this._initSettings();
        
        }
        
        async _initSettings() {
            try {
                let [, result, etag] = await readFile(settingsFile);
                
                const settings = validateJSON(result);
                if(!settings) {
                    throw new Error("Settings are not JSON");
                }

                this._updateInputsFromSettings(settings);
                this._setInputValues(settings);
                this._settings = settings;

            } catch(error) {
                log(`Failed to init settings: Error: ${error}`);
                this._setDefaultSettings();    
            } 
    
        }
        
        _fetchSettingValuesFromInputs() {
            const settings = this._settings;
            
            settings.update_time = Number(this._updateTimeSpinButtonValue);
            settings.fan_speed_threshold = Number(this._fanSpeedThresholdInputValue);
            settings.gpu_temperature_threshold = Number(this._gpuTempThresholdInputValue);
            settings.usb_hub = this._usbHubInputValue;
            settings.usb_port = Number(this._usbPortInputValue);
            settings.default_state = this._comboboxValue;

            return settings;
        }

        async _setDefaultSettings() {
            try {
                const defaultSettings = defaultValues;

                await writeFile(
                    settingsFile,
                    JSON.stringify(defaultSettings),
                );

                this._updateInputsFromSettings(defaultSettings);
                this._setInputValues(defaultSettings);

                this._settings = defaultSettings;

            } catch(error) {
                log(`Failed to set default settings: ${error}`);
            }
        }

        _setInputValues(settings) {
            this._updateTimeSpinButtonValue = settings.update_time;
            this._fanSpeedThresholdInputValue = settings.fan_speed_threshold;
            this._gpuTempThresholdInputValue = settings.gpu_temperature_threshold;
            this._usbHubInputValue = settings.usb_hub;
            this._usbPortInputValue = settings.usb_port;
            this._comboboxValue = settings.default_state;
        }

        _setInputItems() {
            const updateTimeLabel = new Gtk.Label({
                label: "Update time (Seconds)"
            });
            const fanSpeedThresholdLabel = new Gtk.Label({
                label: "Fan speed threshold (RPM)"
            });
            const gpuTempThresholdLabel = new Gtk.Label({
                label: "GPU temprature threshold (Celcius)"
            });
            const usbHubSettingsLabel = new Gtk.Label({
                label: "USB settings"
            });
            const usbHubLabel = new Gtk.Label({
                label: "Hub"
            });
            const usbPortLabel = new Gtk.Label({
                label: "Port"
            });
            this._messageLabel = new Gtk.Label({
                label: " "
            });
      

            this._updateTimeSpinButton = Gtk.SpinButton.new_with_range (1, 60, 1);
            this._fanSpeedThresholdInput = new Gtk.Entry();
            this._gpuTempThresholdInput = new Gtk.Entry();
            this._usbHubInput = new Gtk.Entry();
            this._usbPortInput = Gtk.SpinButton.new_with_range (1, 20, 1);
        
            this._updateTimeBox = new Gtk.Box();
            this._fanSpeedThresholdBox = new Gtk.Box();
            this._gpuTempThresholdBox = new Gtk.Box();
            this._usbHubSettingsTitleBox = new Gtk.Box();
            this._usbHubBox = new Gtk.Box();
            this._usbPortBox = new Gtk.Box();
            this._messageBox = new Gtk.Box();


            this._updateTimeBox.set_orientation(Gtk.Orientation.HORIZONTAL);
            this._fanSpeedThresholdBox.set_orientation(Gtk.Orientation.HORIZONTAL);
            this._gpuTempThresholdBox.set_orientation(Gtk.Orientation.HORIZONTAL);
            this._usbHubSettingsTitleBox.set_orientation(Gtk.Orientation.HORIZONTAL);
            this._usbHubBox.set_orientation(Gtk.Orientation.HORIZONTAL);
            this._usbPortBox.set_orientation(Gtk.Orientation.HORIZONTAL);
            this._messageBox.set_orientation(Gtk.Orientation.HORIZONTAL);

            this._updateTimeBox.pack_start(updateTimeLabel, false, false, 0);
            this._fanSpeedThresholdBox.pack_start(fanSpeedThresholdLabel, false, false, 0);
            this._gpuTempThresholdBox.pack_start(gpuTempThresholdLabel, false, false, 0);
            this._usbHubSettingsTitleBox.pack_start(usbHubSettingsLabel, false, false, 0);
            this._usbHubBox.pack_start(usbHubLabel, false, false, 0);
            this._usbPortBox.pack_start(usbPortLabel, false, false, 0);
            this._messageBox.pack_start(this._messageLabel, false, false, 0);

            this._updateTimeBox.pack_end(this._updateTimeSpinButton, false, false, 0);
            this._fanSpeedThresholdBox.pack_end(this._fanSpeedThresholdInput, false, false, 0);
            this._gpuTempThresholdBox.pack_end(this._gpuTempThresholdInput, false, false, 0);
            this._usbHubBox.pack_end(this._usbHubInput, false, false, 0);
            this._usbPortBox.pack_end(this._usbPortInput, false, false, 0);
     
            this._fanSpeedThresholdInput.set_width_chars(7);
            this._gpuTempThresholdInput.set_width_chars(7);

        }

        _setComboBox() {
            const defaultStateLabel = new Gtk.Label({
                label: "Default state"
            });
            this._defaultStateBox = new Gtk.Box();

            this._comboboxModel = new Gtk.ListStore();
            this._comboboxModel.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

            this._combobox = new Gtk.ComboBox({model: this._comboboxModel});
            const renderer = new Gtk.CellRendererText();
            this._combobox.pack_start(renderer, true);
            this._combobox.add_attribute(renderer, 'text', 1);

            

            this._defaultStateBox.set_orientation(Gtk.Orientation.HORIZONTAL);
            this._defaultStateBox.pack_start(defaultStateLabel, false, false, 0);
            this._defaultStateBox.pack_end(this._combobox, false, false, 0);

            this._comboboxId = this._combobox.connect('changed', (entry) => {
                let [success, iter] = this._combobox.get_active_iter();
                if (!success)
                    return;
                this._comboboxValue = this._comboboxModel.get_value(iter, 0);
            });
        }

        _addSavingsButton() {
            this._saveSettingsButton = new Gtk.Button({ label: 'Save settings'});
            this._saveSettingsButton.set_margin_top(15);

            this._saveSettingsButtonId = this._saveSettingsButton.connect("button-press-event", async (_) => {
                this._saveSettings();
            });

            this.add(this._saveSettingsButton);
        }

        _addItems() {
            const separator = new Gtk.Separator();
            const separator2 = new Gtk.Separator();

            this.add(this._updateTimeBox);
            this.add(this._fanSpeedThresholdBox);
            this.add(this._gpuTempThresholdBox);
            this.add(separator);
            this.add(this._usbHubSettingsTitleBox);
            this.add(this._usbHubBox);
            this.add(this._usbPortBox);
            this.add(separator2);
            this.add(this._defaultStateBox);
            this.add(this._messageBox);
        }

        _addEventListeners() {
            this._updateTimeSpinButtonId = this._updateTimeSpinButton.connect("value-changed", (widget) => {
                this._updateTimeSpinButtonValue = widget.get_text();
            });

            this._fanSpeedThresholdInputId =  this._fanSpeedThresholdInput.connect("key-release-event", (widget) => {
                this._fanSpeedThresholdInputValue = widget.get_text();
            });

            this._gpuTempThresholdInputId =  this._gpuTempThresholdInput.connect("key-release-event", (widget) => {
                this._gpuTempThresholdInputValue = widget.get_text();
            });

            this._usbHubInputId =  this._usbHubInput.connect("key-release-event", (widget) => {
                this._usbHubInputValue = widget.get_text();
            });

            this._usbPortInputId =  this._usbPortInput.connect("value-changed", (widget) => {
                this._usbPortInputValue = widget.get_text();
            });

        }

        async _saveSettings() {
            try {
                this._sendNotification('Saving settings');

                const settings = this._fetchSettingValuesFromInputs();
                this._validateSettingInputs(settings);

                await writeFile(
                    settingsFile,
                    JSON.stringify(settings),
                );

                this._sendNotification('Saved successfully :-)');
            } catch(error) {
                log(`Error: ${error}`);
                this._sendNotification('Failed to save settings, please make all inputs are filled corretly');
            }
        }

        _updateInputsFromSettings(settings) {
            this._updateTimeSpinButton.set_value(Number(settings.update_time));
            this._fanSpeedThresholdInput.set_text(String(settings.fan_speed_threshold)); 
            this._gpuTempThresholdInput.set_text(String(settings.gpu_temperature_threshold));
            this._usbHubInput.set_text(String(settings.usb_hub));
            this._usbPortInput.set_value(Number(settings.usb_port));

            for(let k in settings.usb_options){
                this._comboboxModel.set(this._comboboxModel.append(), [0, 1], [k, settings.usb_options[k]]);
            }

            this._combobox.set_active(Object.keys(settings.usb_options).indexOf(settings.default_state));

   
        }

        _sendNotification(message) {
            this._messageLabel.set_text(message);            

            setTimeout(() => {
                this._messageLabel.set_text(this.DEFAULT_MESSAGE_LABEL); 
            }, 4000);
        }

        _validateSettingInputs(settings) {
            if(!settings.update_time ||
             !settings.fan_speed_threshold ||
             !settings.gpu_temperature_threshold ||
             !settings.usb_hub ||
             !settings.usb_port || 
             !settings.default_state) {
                 throw new Error('Please make sure that all inputs are filled');
             }
         }

        _destroyAllListeners() {
            this._updateTimeSpinButton.disconnect(this._updateTimeSpinButtonId);
            this._fanSpeedThresholdInput.disconnect(this._fanSpeedThresholdInputId);
            this._gpuTempThresholdInput.disconnect(this._gpuTempThresholdInputId);
            this._usbHubInput.disconnect(this._usbHubInputId);
            this._usbPortInput.disconnect(this._usbPortInputId);
            this._combobox.disconnect(this._comboboxId);
            this._saveSettingsButton.disconnect(this._saveSettingsButtonId);
        }
    }
)        

function buildPrefsWidget() {
    let widget = new MyPrefsWidget();
    widget.show_all();
    return widget;
}

function init() {
}
