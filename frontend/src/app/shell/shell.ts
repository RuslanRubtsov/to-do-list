import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Language, TodoList, TodoListRole } from '@api';
import { Session } from '../auth/session';
import { LANGUAGE_NAMES, Languages } from '../i18n/languages';
import { TodoListNameDialog, TodoListNameDialogData } from '../todo-lists/todo-list-name-dialog';
import { TodoLists } from '../todo-lists/todo-lists';
import { UndoableDeletes } from '../undo/undoable-deletes';
import { switchMap } from 'rxjs';
import { mediaMatches, PHONE_QUERY } from './media';
import { ThemeService } from './theme';

/** The frame every page lives in: toolbar, navigation drawer, language and theme switches. */
@Component({
  selector: 'app-shell',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  // The pages in the shell's outlet share the drawer's Todo Lists and the deletes still held for
  // Undo; a new session gets new ones
  providers: [TodoLists, UndoableDeletes],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly session = inject(Session);
  protected readonly languages = inject(Languages);
  protected readonly languageNames = LANGUAGE_NAMES;
  protected readonly todoLists = inject(TodoLists);
  /** The User's own Todo Lists; `undefined` until loaded. */
  protected readonly owned = computed(() =>
    this.todoLists.all()?.filter((todoList) => todoList.role === TodoListRole.OWNER),
  );
  /** Those other Users Shared with the User, listed apart. */
  protected readonly shared = computed(() =>
    this.todoLists.all()?.filter((todoList) => todoList.role !== TodoListRole.OWNER),
  );
  private readonly deletes = inject(UndoableDeletes);
  private readonly dialogs = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
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

  /**
   * Saves the language as the User's preference, so the app opens in it on any device, then
   * reloads this page in it.
   */
  protected switchLanguage(language: Language): void {
    this.session.updateProfile({ preferredLanguage: language }).subscribe({
      next: () => this.languages.open(language, this.router.url),
      error: () =>
        this.snackBar.open(
          $localize`:Message when saving the language preference fails:Couldn't switch the language. Check your connection and try again.`,
          $localize`:Dismisses a message:OK`,
        ),
    });
  }

  /** Sends the deletes the User was still offered Undo for, while the session can, then logs out. */
  protected logOut(): void {
    this.deletes
      .sendAll()
      .pipe(switchMap(() => this.session.logOut()))
      .subscribe({
        next: () => void this.router.navigateByUrl('/login'),
        error: () =>
          this.snackBar.open(
            $localize`:Message when logging out fails:Couldn't log out. Check your connection and try again.`,
            $localize`:Dismisses a message:OK`,
          ),
      });
  }

  /** Asks for a name, creates the Todo List, then opens it. */
  protected createTodoList(): void {
    this.dialogs
      .open<TodoListNameDialog, TodoListNameDialogData, TodoList>(TodoListNameDialog, {
        data: { save: (name) => this.todoLists.create(name) },
      })
      .afterClosed()
      .subscribe((created) => {
        if (!created) return;
        void this.router.navigate(['/lists', created.id]);
        this.closeDrawerOnPhone();
      });
  }

  /** On phones the drawer covers the page, so it gets out of the way once a destination is chosen. */
  protected closeDrawerOnPhone(): void {
    if (this.phone()) void this.drawer().close();
  }
}
