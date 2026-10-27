import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { mediaMatches, PHONE_QUERY } from './media';
import { ThemeService } from './theme';

/** The frame every page lives in: toolbar, navigation drawer and theme switch. */
@Component({
  selector: 'app-shell',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly phone = mediaMatches(PHONE_QUERY);
  private readonly drawer = viewChild.required(MatSidenav);

  /** What the theme switch turns on: the opposite of the current theme. */
  protected readonly themeToggle = computed(() =>
    this.theme.current() === 'dark'
      ? {
          icon: 'light_mode',
          label: $localize`:Toolbar button that turns on the light theme:Switch to light theme`,
        }
      : {
          icon: 'dark_mode',
          label: $localize`:Toolbar button that turns on the dark theme:Switch to dark theme`,
        },
  );

  /** On phones the drawer covers the page, so it gets out of the way once a destination is chosen. */
  protected closeDrawerOnPhone(): void {
    if (this.phone()) void this.drawer().close();
  }
}
