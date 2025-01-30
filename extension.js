const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();
imports.gi.GLib.setenv('GSETTINGS_SCHEMA_DIR', Me.dir.get_child('schemas').get_path(), true);

let panelButton, panelButtonText, timeout, myPopup;


const Mypopup = GObject.registerClass(
    class MyPopup extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'VM Quickstart', false);

            this._refreshInterval = null;
            this._settings = new Gio.Settings({
              schema_id: 'org.gnome.shell.extensions.VM-Quickstart',
              path: '/org/gnome/shell/extension/VM-quickstart/'
            });

            let icon = new St.Icon({
                gicon: Gio.icon_new_for_string(Me.dir.get_path() + '/media/VM-Quickstart-White.png'),
                icon_size: 48,
                style_class: 'system-status-icon'
            });
            this.add_child(icon);

            // Elementos estaticos
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._addRefreshButton();
            this.menu.addMenuItem(
                new PopupMenu.PopupMenuItem("VM Quickstart Menu", { reactive: false })
            );

            // Configurar actualizacion automatica
            this._setupAutoRefresh();
            this._refreshVMs(); 
        }

        _setupAutoRefresh() {
            // Actualizar cada 30 segundos
            this._refreshInterval = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                30,
                () => {
                    this._refreshVMs();
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }

        _addRefreshButton() {
            let refreshItem = new PopupMenu.PopupMenuItem("Refresh list");
            let icon = new St.Icon({
                icon_name: 'view-refresh-symbolic',
                icon_size: 12
            });
            refreshItem.add_child(icon);
            refreshItem.connect('activate', () => this._refreshVMs());
            this.menu.addMenuItem(refreshItem);
        }

        _refreshVMs() {

            this.menu.removeAll();

            // Obtener nuevas VMs
            this._vms = this._getVirtualMachinesWithState();

            // Agregar elementos actualizados
            this._vms.forEach(vm => {
                // max 25 caracteres
                const maxNameLength = 25;
                const displayName = vm.name.length > maxNameLength 
                    ? vm.name.substring(0, maxNameLength - 3) + '...' 
                    : vm.name;
                
                let menuItem = new PopupMenu.PopupMenuItem(`${displayName} (${vm.state})`);
                
                // Icono de estado
                let stateIcon = new St.Icon({
                    icon_name: vm.state === 'running' ? 'system-run-symbolic' : 'system-shutdown-symbolic',
                    icon_size: 12,
                    style_class: 'vm-status-icon'
                });
                menuItem.add_child(stateIcon);
                
                menuItem.connect('activate', () => {
                    this._startVM(vm.name);
                    // Actualizar estado despues de iniciar
                    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                        this._refreshVMs();
                        return GLib.SOURCE_REMOVE;
                    });
                });
                this.menu.addMenuItem(menuItem);
            });

            // Volver a añadir elementos fijos
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._addRefreshButton();
            this.menu.addMenuItem(
                new PopupMenu.PopupMenuItem("VM Quickstart Menu", { reactive: false })
            );
        }

        _getVirtualMachinesWithState() {
            let [ok, out, err, exit] = GLib.spawn_command_line_sync('vboxmanage list vms -l');
            if (!ok) {
                logError(new Error('Error ejecutando vboxmanage list vms -l'));
                return [];
            }

            let output = new TextDecoder("utf-8").decode(out).trim();
            if (!output) return [];

            return output.split('\n\n').map(vmBlock => {
                let nameMatch = vmBlock.match(/Name:\s+(.+)/);
                let stateMatch = vmBlock.match(/State:\s+(.+)/);
                
                return {
                    name: nameMatch ? nameMatch[1] : 'Unknown',
                    state: stateMatch ? stateMatch[1].includes('running') ? 'running' : 'stopped' : 'unknown'
                };
            }).filter(vm => vm.name !== 'Unknown');
        }

        _startVM(vmName) {
            GLib.spawn_command_line_async(`vboxmanage startvm "${vmName}" --type gui`);
            Main.notify(`Iniciando VM: ${vmName}`);
        }

        destroy() {
            if (this._refreshInterval) {
                GLib.source_remove(this._refreshInterval);
                this._refreshInterval = null;
            }
            super.destroy();
        }
    }
);


function setButtonText() {
    var [ok, out, err, exit] = GLib.spawn_command_line_sync('/bin/bash -c "cat $HOME/.config/VirtualBox/VBoxSVC.log | grep Launched | tail -1 | awk -F\'name: \' \'{print $2}\'"');

    var output = new TextDecoder("utf-8").decode(out).trim();
    var limitedOutput = output.length > 12 ? output.slice(0, 12) + "..." : output
    panelButtonText.set_text(limitedOutput);

    return true;
}

function init() {
    panelButton = new St.Bin({
        style_class: "panel-button"
    });

    panelButtonText = new St.Label({
        style_class: "panelText",
        text: "VMQ"
    });

    panelButton.set_child(panelButtonText);
}

function enable() {
    myPopup = new Mypopup();
    Main.panel.addToStatusArea('myPopup', myPopup, 1);
}

function disable() {
    myPopup.destroy();
}
