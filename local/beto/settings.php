<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_beto', get_string('pluginname', 'local_beto'));
    $ADMIN->add('localplugins', $settings);

    $settings->add(new admin_setting_configtext(
        'local_beto/baseurl',
        get_string('baseurl', 'local_beto'),
        get_string('baseurl_desc', 'local_beto'),
        '',
        PARAM_URL
    ));
}
