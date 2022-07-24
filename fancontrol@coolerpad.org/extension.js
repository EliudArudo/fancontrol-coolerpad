const Me = imports.misc.extensionUtils.getCurrentExtension();
const {
    St,
    Gio,
    Gtk,
    GLib,
    Pango,
    GObject,
    Main,
    Mainloop,
    PanelMenu,
    PopupMenu,
    Animation,
    ByteArray,
    Util,
    MessageTray,
    gicon_off,
    gicon_on,
    gicon_auto,
    gicon_disabled,
    settingsFile,
} = Me.imports.core;

const {
    readFile,
    writeFile,
    validateJSON,
    setTimeout,
    defaultValues,
    runCommandAsync,
    checkSubstringInString,
} = Me.imports.utils;


let myPopup;

const MyPopup = GObject.registerClass(
    class MyPopup extends PanelMenu.Button {

        _init () {
            super._init(0);

            this._actionsAreDisabled = false;

            this._onButton = null;
            this._offButton = null;
            this._autoButton = null;
            this._refreshButton = null;
            this._preferencesButton = null;

            this._onButtonId = null;
            this._offButtonId = null;
            this._autoButtonId = null;
            this._refreshButtonId = null;
            this._preferencesButtonId = null;

            this._updateTime = null;
            this._fanSpeedThreshold = null;
            this._gpuTempThreshold = null;
            this._usbHub = null;
            this._usbPort = null;
            this._defaultState = null;

            this._settings = null;
            this._timeout = null;

            this._icon = new St.Icon({
                gicon : gicon_off,
                style_class : 'panel-icon-border',
            });

            
            this.add_child(this._icon);

            this._onButton = new PopupMenu.PopupMenuItem('• On');
            this._offButton = new PopupMenu.PopupMenuItem('  Off');
            this._autoButton = new PopupMenu.PopupMenuItem('  Auto');
            this._refreshButton = new PopupMenu.PopupMenuItem('Refresh');
            this._preferencesButton = new PopupMenu.PopupMenuItem('Preferences');
            
            const separator = new PopupMenu.PopupSeparatorMenuItem();
            
            this.menu.addMenuItem(this._onButton);
            this.menu.addMenuItem(this._offButton);
            this.menu.addMenuItem(this._autoButton);
            this.menu.addMenuItem(separator);
            this.menu.addMenuItem(this._refreshButton);
            this.menu.addMenuItem(this._preferencesButton);

            this._setupOnButtonListener(this._onButton);
            this._setupOffButtonListener(this._offButton);  
            this._setupAutoButtonListener(this._autoButton);
            this._setupRefreshButtonListener(this._refreshButton);
            this._setupPreferencesButtonListener(this._preferencesButton);
            this._setMenuListener();

            this._firstInitOfSettings();
            
        }

        _isActive(button) {
            return button.label.get_text().toLowerCase().includes('•');
        }

        async _firstInitOfSettings() {
            try {
                await this._activateBasedOnHubAvailability();

                switch(this._defaultState) {
                    case 'on':
                        await this._powerOnPort();
                        break;
                    case 'off':
                        await this._powerOffPort();
                        break;
                    case 'auto':
                        await this._startAutoProcess();
                        break;        
                }
            } catch(error) {
                log(`Cannot first initialize settings: Error: ${error}`);
            }
        }

        async _fetchAndSetSettings() {
            let [, result, etag] = await readFile(settingsFile);
                
            const settings = validateJSON(result);
            if(!settings) {
                throw new Error("Settings are not JSON");
            }

            this._settings = settings;
        }


        async _initSettings() {
            try {
                await this._fetchAndSetSettings();
                this._setVariables();
                this._updateActionButtons();
            } catch(error) {        
                log(`Failed to init settings: Error: ${error}`);
                this._setDefaultSettings();    
            }
        }

        async _fetchCPUInfo() {
            try {
                const sensorsData = await runCommandAsync(['sensors']);

                const separated = sensorsData.split('\n');

                const fan1Line = separated.find(line => line.toLowerCase().includes('fan1'.toLowerCase()));
                const fan2Line = separated.find(line => line.toLowerCase().includes('fan2'.toLowerCase()));
                const gpuLine = separated.find(line => line.toLowerCase().includes('Package id 0:'.toLowerCase()));  

                const fan1LineArray = fan1Line.split(" ");
                const fan2LineArray = fan2Line.split(" ");
                const gpuLineArray = gpuLine.split(" ");

                const fan1Speed = Number(fan1LineArray[fan1LineArray.length - 2]);
                const fan2Speed = Number(fan1LineArray[fan2LineArray.length - 2]);
                const gpuTemperature = Number(gpuLineArray[4].match(/\d+/)[0]);

                return { fan1Speed, fan2Speed, gpuTemperature };

            } catch(error) {
                throw error;
            }
        }

        _getUSBPortCommand(state = 'off') {
            return `sudo uhubctl -a ${state} -p ${this._usbPort} -l ${this._usbHub}`;
        }


        _setIcon(label) {
            if (this._actionsAreDisabled) return;

            const text = label.toLowerCase().trim();
 
            switch(text) {
                case 'on':
                    this._icon.gicon = gicon_on;
                    break;
                case 'off':
                    this._icon.gicon = gicon_off;
                    break;
                case 'auto':
                    this._icon.gicon = gicon_auto;
                    break;        
                }
                this._icon.set_style_class_name('v2-icon'); 
         }
 
         _setVariables() {
            this._updateTime = this._settings.update_time;
            this._fanSpeedThreshold = this._settings.fan_speed_threshold;
            this._gpuTempThreshold = this._settings.gpu_temperature_threshold;
            this._usbHub = this._settings.usb_hub;
            this._usbPort = this._settings.usb_port;
            this._defaultState = this._settings.default_state;
        }

        _disableActions() {
            this._actionsAreDisabled = true;
            this._icon.gicon = gicon_disabled;
            // this.setSensitive(false);
            this._onButton.actor.setSensitive(false);
            this._offButton.actor.setSensitive(false);
            this._autoButton.actor.setSensitive(false);
        }

        async _setDefaultSettings() {
            try {
                const defaultSettings = defaultValues;

                await writeFile(
                    settingsFile,
                    JSON.stringify(defaultSettings),
                );

                this._setVariables();
                this._updateActionButtons();

                this._settings = defaultSettings;

            } catch(error) {
                log(`Failed to set default settings: ${error}`);
            }
        }

        _setupOnButtonListener(onButton) {
            this._onButtonId = onButton.connect("activate", () => {
                if(this._isActive(onButton)) {
                    return;
                }
                this._powerOnPort();
            });
        }

        _setupOffButtonListener(offButton) {
            this._offButtonId = offButton.connect("activate", () => {
                if(this._isActive(offButton)) {
                    return;
                }
                this._powerOffPort();
            });
        }

        _setupAutoButtonListener(autoButton) {
            this._autoButtonId = autoButton.connect("activate", () => {
                if(this._isActive(autoButton)) {
                    return;
                }
                this._startAutoProcess();
            });
        }

        _setupRefreshButtonListener(refreshButton) {
            this._refreshButtonId = refreshButton.connect("activate", () => {
                log("Refreshing extension");
                Util.spawn(["gnome-extensions", "restart", Me.metadata.uuid]);
                this.menu.close();
            });
        }

        _setupPreferencesButtonListener(preferencesButton) {
            this._preferencesButtonId = preferencesButton.connect("activate", () => {
                log("Opening settings");
                Util.spawn(["gnome-extensions", "prefs", Me.metadata.uuid]);
                this.menu.close();
            });
        }

        _setMenuListener() {
            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    this._initSettings();
                }
            });
        }

        _startTimeout() {
            this._timeout = Mainloop.timeout_add_seconds(this._settings.update_time, this._runAutoProcess.bind(this));
        }

        async _startAutoProcess() {
            try {
               await this._runAutoProcess();
               this._startTimeout();  

               const state = 'auto';
               await this._saveSettingsWithValue(state);
               await this._initSettings();
            } catch(error) {
               log(`Failed to startAutoProcess: Error: ${error}`); 
            }
        }


        async _powerOnPort() {
            try {
                this._stopTimeout();
                const state = 'on';
                await this._powerPort(state);
                
                await this._saveSettingsWithValue(state);
                await this._initSettings();

            } catch(error) {
                log(`Failed to power on port: ${error}`);
            }
        }

  
        async _saveSettingsWithValue(state) {
            try {
                this._settings.default_state = state;
                
                await writeFile(
                    settingsFile,
                    JSON.stringify(this._settings),
                );

                this._sendNotification(`Fans are ${state}`);
            } catch(error) {
                log(`Error: ${error}`);
                this._sendNotification('Failed operation', false);
            }
        }

        async _runAutoProcess() {
            try {
                await this._initSettings();
                const { fan1Speed, fan2Speed, gpuTemperature } = await this._fetchCPUInfo();

                if(fan1Speed >= this._settings.fan_speed_threshold ||
                   fan2Speed >= this._settings.fan_speed_threshold ||
                   gpuTemperature > this._settings.gpu_temperature_threshold) {
                       this._powerPort('on');
                       return;
                   } 

                this._powerPort('off');
            } catch(error) {
                log(`Error: ${error}`);
            }
        }

        _updateActionButtons() {
            const buttons = [
                this._onButton,
                this._offButton,
                this._autoButton,
            ];

            let text, cleanText;

            for(const button of buttons) {
                text = button.actor.label.get_text();
                cleanText = text.replace(/[•\t.+]/g, ' ');

                if(text.toLowerCase().includes(this._defaultState)) {
                    this._setIcon(cleanText);
                    button.label.set_text(`• ${cleanText.trim()}`);
                    continue;
                } 

                button.label.set_text(cleanText);
            }
        }

        _sendNotification(message, success = true) {
            const icon = success? 'emblem-ok-symbolic' : 'application-exit-symbolic';
            let source = new MessageTray.Source(Me.metadata.name, icon);
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(source, Me.metadata.name, message);
            notification.setTransient(true);
            source.showNotification(notification);
        }

        async _powerPort(state) {
            try {
                const command = this._getUSBPortCommand(state);
                await runCommandAsync(command.split(' '));
            } catch(error) {
                throw error;
            }
        }

        async _activateBasedOnHubAvailability() {
            try {
                await this._fetchAndSetSettings();
                let hubIsAvailable = await this._checkHubAvailablility();

                // MOCK
                // hubIsAvailable = false;

                if (!hubIsAvailable) {
                    this._disableActions();
                    this._sendNotification(`Hub is not available or is inactive`, false);
                    throw new Error('Hub is not available');
                }

                await this._initSettings();

            } catch (error) {
                throw(error);
            }
        }

        async _checkHubAvailablility() {
            try {
                const results = await runCommandAsync(['sudo', 'uhubctl']);

                const hubSubstring = `hub ${ this._settings.usb_hub }`;
                const hubAvailable = checkSubstringInString(hubSubstring, results);

                return hubAvailable;
            } catch (error) {
                log(`_checkHubAvailablility error: ${ error }`);
                return false;
            }
        }

        _stopTimeout() {
            try {
                Mainloop.source_remove(this._timeout);
            } catch(error) {
                log('No previous timeouts in loop');
            }
        }
 
        async _powerOffPort() {
            try {
                this._stopTimeout();
                const state = 'off';
                await this._powerPort(state);

                await this._saveSettingsWithValue(state);
                await this._initSettings();

            } catch(error) {
                log(`Failed to power off port: ${error}`);
            }
        }

        _reset() {
            this._onButton.actor.disconnect(this._onButtonId);
            this._offButton.actor.disconnect(this._offButtonId);
            this._autoButton.actor.disconnect(this._autoButtonId);
            this._refreshButton.actor.disconnect(this._refreshButtonId);
            this._preferencesButton.actor.disconnect(this._preferencesButtonId);

            this._onButton = null;
            this._offButton = null;
            this._autoButton = null;
            this._refreshButton = null;
            this._preferencesButton = null;

            this._icon = null;

        }

        destroy() {
            this._stopTimeout();
            this._reset();
            super.destroy();
        }

    }
)


function init() {
    log(`Initializing ${Me.metadata.name}`);
}

function enable() {  
  myPopup = new MyPopup();
  Main.panel.addToStatusArea('Cooler pad fan control', myPopup, 3, 'right');
}

function disable() {
  myPopup.destroy();
}