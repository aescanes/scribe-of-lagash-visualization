// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

export interface ScribeVisualizationSettings {
	/** Timeline shown by default when the Timeline view opens; "" means "all entries". */
	defaultTimeline: string;
}

export const DEFAULT_SETTINGS: ScribeVisualizationSettings = {
	defaultTimeline: "",
};
