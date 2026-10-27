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
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './start-page.html',
  styleUrl: './start-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartPage {
  private readonly appInfoService = inject(AppInfoService);

  protected readonly appInfo = rxResource({
    stream: () => this.appInfoService.getAppInfo(),
  });

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

const UNREACHABLE_STATUSES = new Set([
  0,
  HttpStatusCode.BadGateway,
  HttpStatusCode.ServiceUnavailable,
  HttpStatusCode.GatewayTimeout,
]);
