const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();

let panelButton, panelButtonText, timeout, myPopup;

const Mypopup = GObject.registerClass(
    class MyPopup extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'VM Quickstart', false);

            let icon = new St.Icon({
                gicon: Gio.icon_new_for_string(Me.dir.get_path() + '/media/VM-Quickstart-White.png'),
                icon_size: 48,
                style_class: 'system-status-icon'
            });
            this.add_child(icon);

            // Array de máquinas
            this._vms = this._getVirtualMachines();

            // Agregar elementos al menú
            this._vms.forEach(vm => {
                let menuItem = new PopupMenu.PopupMenuItem(vm);
                menuItem.connect('activate', () => {
                    this._startVM(vm);
                });
                this.menu.addMenuItem(menuItem);
            });

            // Separador
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Información adicional
            this.menu.addMenuItem(
                new PopupMenu.PopupMenuItem("VM Quickstart Menu", { reactive: false })
            );
        }

        // Métodos privados de la clase
        _getVirtualMachines() {
            let [ok, out, err, exit] = GLib.spawn_command_line_sync('vboxmanage list vms');
            if (!ok) {
                logError(new Error('Error ejecutando vboxmanage list vms'));
                return [];
            }

            let output = new TextDecoder("utf-8").decode(out).trim();
            if (!output) {
                return [];
            }

            return output
                .split('\n')
                .map(line => line.match(/^"([^"]+)"/)) // nombre entre comillas
                .filter(match => match)
                .map(match => match[1]); // Obtener solo el nombre
        }

        _startVM(vmName) {
            GLib.spawn_command_line_async(`vboxmanage startvm "${vmName}" --type gui`);
            log(`Starting VM: ${vmName}`);
        }
    }
);



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
