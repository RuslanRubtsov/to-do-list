import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppInfoService } from '@api';

@Component({
  selector: 'app-start-page',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './start-page.html',
  styleUrl: './start-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartPage {
  private readonly appInfoService = inject(AppInfoService);

  protected readonly appInfo = rxResource({
    stream: () => this.appInfoService.getAppInfo(),
  });

  /** Calendar days, in the user's time zone, since the backend was built. */
  protected readonly daysSinceBuild = computed(() =>
    this.appInfo.hasValue()
      ? calendarDaysBetween(new Date(this.appInfo.value().buildTime), new Date())
      : 0,
  );

  /**
   * The backend didn't answer: no response at all, or the reverse proxy in front of it reporting a
   * gateway error. As opposed to the backend answering with an error of its own.
   */
  protected readonly unreachable = computed(() => {
    const error = this.appInfo.error();
    // A resource wraps errors that aren't Error instances, which HttpErrorResponse isn't
    const cause = error instanceof HttpErrorResponse ? error : error?.cause;
    return cause instanceof HttpErrorResponse && UNREACHABLE_STATUSES.has(cause.status);
  });
}

function calendarDaysBetween(earlier: Date, later: Date): number {
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  // Rounding absorbs the 23- and 25-hour days at daylight-saving changes
  return Math.round((startOfDay(later) - startOfDay(earlier)) / MS_PER_DAY);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const UNREACHABLE_STATUSES = new Set([
  0,
  HttpStatusCode.BadGateway,
  HttpStatusCode.ServiceUnavailable,
  HttpStatusCode.GatewayTimeout,
]);
