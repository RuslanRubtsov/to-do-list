import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Languages } from '../i18n/languages';
import { returnUrlTree } from './guards';
import { Session } from './session';

/** Where a User goes once logged in: the page they asked for, in the language they prefer. */
@Injectable({ providedIn: 'root' })
export class Entrance {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly languages = inject(Languages);

  /**
   * Opens the requested page, or the start page. When the User prefers another language than
   * this build's, possibly chosen on another device, the page opens in that language's build.
   */
  enter(returnUrl: string | null | undefined): void {
    const target = returnUrlTree(this.router, returnUrl);
    const preferred = this.session.user()?.preferredLanguage;
    if (preferred && preferred !== this.languages.current) {
      this.languages.open(preferred, this.router.serializeUrl(target));
    } else {
      void this.router.navigateByUrl(target);
    }
  }
}
