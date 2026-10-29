import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppInfoService } from '@api';
import { DashboardView } from '../dashboard/dashboard';
import { isUnreachable } from '../http/problems';

@Component({
  selector: 'app-start-page',
  imports: [
    DashboardView,
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

  protected readonly unreachable = computed(() => isUnreachable(this.appInfo.error()));
}

function calendarDaysBetween(earlier: Date, later: Date): number {
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  // Rounding absorbs the 23- and 25-hour days at daylight-saving changes
  return Math.round((startOfDay(later) - startOfDay(earlier)) / MS_PER_DAY);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
