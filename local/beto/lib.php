<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

/**
 * Adds the Beto embed to authenticated, non-guest Moodle pages.
 */
function local_beto_before_footer() {
    if (!isloggedin() || isguestuser()) {
        return;
    }

    $baseurl = trim((string)get_config('local_beto', 'baseurl'));
    if ($baseurl === '') {
        return;
    }

    $parts = parse_url($baseurl);
    if (
        $parts === false ||
        empty($parts['host']) ||
        empty($parts['scheme']) ||
        !in_array(strtolower($parts['scheme']), ['http', 'https'], true) ||
        isset($parts['user']) ||
        isset($parts['pass']) ||
        isset($parts['query']) ||
        isset($parts['fragment'])
    ) {
        debugging('Beto was not loaded because its base URL is invalid.', DEBUG_DEVELOPER);
        return;
    }

    $baseurl = rtrim($baseurl, '/');
    $scripturl = $baseurl . '/beto-embed.js';
    $tag = html_writer::tag('script', '', [
        'src' => $scripturl,
        'data-chatbot-url' => $baseurl . '/',
        'defer' => 'defer',
    ]);
    echo $tag;
}
