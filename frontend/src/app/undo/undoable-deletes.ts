import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { forkJoin, map, Observable, of, Subscription } from 'rxjs';

/** How long a delete can be undone before it is sent. */
const UNDO_DURATION_MS = 5000;

/** A delete the UI already shows as done, but holds back while Undo is offered. */
export interface HeldDelete {
  /** What the Undo offer says, naming what was deleted. */
  message: string;
  /** Sends the delete, dealing with its own failure, and completes once it is answered. */
  send: () => Observable<void>;
  /** Shows what was deleted again. */
  undo: () => void;
}

/**
 * Offers Undo for deletes, sending each only once its offer times out or gives way to another
 * message; Undo sends nothing. Provided by the app shell, so an offer outlives the page it was
 * made on.
 *
 * Logging out sends the deletes still held first (see {@link sendAll}). Leaving the app shell
 * otherwise, as when the session can no longer be refreshed, can't send them: the offers are
 * withdrawn and nothing is deleted.
 */
@Injectable()
export class UndoableDeletes {
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  private readonly held = new Set<{
    held: HeldDelete;
    offer: MatSnackBarRef<TextOnlySnackBar>;
    onGone: Subscription;
  }>();

  /** Offers Undo for the delete. Returns what ends the offer early, which sends the delete. */
  offer(held: HeldDelete): () => void {
    const offer = this.snackBar.open(
      held.message,
      $localize`:Button that brings back what was just deleted:Undo`,
      { duration: UNDO_DURATION_MS },
    );
    const withdraw = this.destroyRef.onDestroy(() => offer.dismiss());
    const onGone = offer
      .afterDismissed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ dismissedByAction: undone }) => {
        withdraw();
        this.held.delete(entry);
        if (undone) held.undo();
        else held.send().subscribe();
      });
    const entry = { held, offer, onGone };
    this.held.add(entry);
    return () => offer.dismiss();
  }

  /** Ends every Undo offer still open and sends its delete, completing once they are answered. */
  sendAll(): Observable<void> {
    const deletes = [...this.held].map(({ held, offer, onGone }) => {
      onGone.unsubscribe();
      offer.dismiss();
      return held.send();
    });
    this.held.clear();
    return deletes.length ? forkJoin(deletes).pipe(map(() => undefined)) : of(undefined);
  }
}
