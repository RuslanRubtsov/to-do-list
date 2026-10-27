/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyTheme, rememberedTheme } from './app/shell/theme';

// Before Angular starts, so the page doesn't render in the system's theme first
applyTheme(document.documentElement, rememberedTheme());

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
