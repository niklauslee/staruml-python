/*
 * Copyright (c) 2013-2014 Minkyu Lee. All rights reserved.
 *
 * NOTICE:  All information contained herein is, and remains the
 * property of Minkyu Lee. The intellectual and technical concepts
 * contained herein are proprietary to Minkyu Lee and may be covered
 * by Republic of Korea and Foreign Patents, patents in process,
 * and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Minkyu Lee (niklaus.lee@gmail.com).
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, app, $, _, window, appshell, staruml */

define(function (require, exports, module) {
    "use strict";

    var AppInit           = app.getModule("utils/AppInit"),
        Core              = app.getModule("core/Core"),
        PreferenceManager = app.getModule("core/PreferenceManager");

    var preferenceId = "python";

    var pythonPreferences = {
        "python.gen": {
            text: "Python Code Generation",
            type: "Section"
        },
        "python.gen.installPath": {
            text: "Installation Path",
            description: "Installation path of python",
            type: "String",
            default: "#!/usr/bin/python"
        },
        "python.gen.useTab": {
            text: "Use Tab",
            description: "Use Tab for indentation instead of spaces.",
            type: "Check",
            default: true
        }
    };

    function getId() {
        return preferenceId;
    }

    function getGenOptions() {
        return {
            installPath : PreferenceManager.get("python.gen.installPath"),
            useTab      : PreferenceManager.get("python.gen.useTab")
        };
    }

    AppInit.htmlReady(function () {
        PreferenceManager.register(preferenceId, "Python", pythonPreferences);
    });

    exports.getId         = getId;
    exports.getGenOptions = getGenOptions;

});
