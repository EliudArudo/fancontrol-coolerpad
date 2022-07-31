const Me = imports.misc.extensionUtils.getCurrentExtension();

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;

const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Animation = imports.ui.animation;
const ByteArray = imports.byteArray;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;

const version = 'v4';

const gicon_off = Gio.icon_new_for_string(Me.path + `/icons/${version}/fan-default.svg`);
const gicon_on = Gio.icon_new_for_string(Me.path + `/icons/${version}/fan-on.svg`);
const gicon_auto = Gio.icon_new_for_string(Me.path + `/icons/${version}/fan-auto.svg`);
const gicon_temprange = Gio.icon_new_for_string(Me.path + `/icons/${version}/fan-temprange.svg`);
const gicon_disabled = Gio.icon_new_for_string(Me.path + `/icons/${version}/fan-disabled.svg`);

const settingsFile = Gio.File.new_for_path(Me.path + '/.config/settings.json');

