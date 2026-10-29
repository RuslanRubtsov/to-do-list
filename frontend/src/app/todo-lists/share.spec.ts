import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Share, ShareRole } from '@api';
import { snackBarText } from '../../testing/routed-page';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { failFieldAsInvalid, GROCERIES } from '../../testing/todo-lists';

const SHARES = { method: 'POST', url: `/api/v1/todo-lists/${GROCERIES.id}/shares` };
const SHARES_LIST = { method: 'GET', url: SHARES.url };

/** Changing the role a Share gives, or revoking it. */
function shareRequest(method: 'PATCH' | 'DELETE', userId: number) {
  return { method, url: `${SHARES.url}/${userId}` };
}

const TARAS: Share = {
  userId: 9,
  email: 'taras@example.com',
  displayName: 'Taras',
  role: ShareRole.EDITOR,
};
const ANNA: Share = {
  userId: 10,
  email: 'anna@example.com',
  displayName: 'Anna',
  role: ShareRole.EDITOR,
};
const VIEWING_TARAS: Share = { ...TARAS, role: ShareRole.VIEWER };

describe('Sharing a Todo List', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /** Opens the sharing dialog, answering whom the Todo List is Shared with already. */
  async function openShareDialog(shares: Share[] = []) {
    const page = await renderTodoListPage(GROCERIES);
    page.click('Share Todo List');
    await vi
      .waitFor(() => page.http.expectOne(SHARES_LIST))
      .then((request) => request.flush(shares));
    await page.text();
    return page;
  }

  describe('whom it is Shared with', () => {
    it('lists them by name, with their emails and roles', async () => {
      const page = await openShareDialog([ANNA, VIEWING_TARAS]);

      expect(page.listItems('Shared with')).toEqual([
        'Anna anna@example.com Editor',
        'Taras taras@example.com Viewer',
      ]);
    });

    it('says when it is Shared with no one yet', async () => {
      const page = await openShareDialog();

      expect(page.listItems('Shared with')).toBeUndefined();
      expect(document.body.textContent).toContain('It isn’t Shared with anyone yet.');
    });

    it('changes the role a Share gives', async () => {
      const page = await openShareDialog([ANNA, VIEWING_TARAS]);

      const chosen = page.choose('Role of Taras', 'Editor');
      const change = await vi.waitFor(() =>
        page.http.expectOne(shareRequest('PATCH', TARAS.userId)),
      );
      expect(change.request.body).toEqual({ role: 'EDITOR' });
      change.flush(TARAS);
      await chosen;

      expect(await page.chosen('Role of Taras')).toBe('Editor');
    });

    it('puts the role back, and says so, when changing it fails', async () => {
      const page = await openShareDialog([VIEWING_TARAS]);

      const chosen = page.choose('Role of Taras', 'Editor');
      await vi
        .waitFor(() => page.http.expectOne(shareRequest('PATCH', TARAS.userId)))
        .then((request) => request.error(new ProgressEvent('error'), { status: 0 }));
      await chosen;

      expect(await page.chosen('Role of Taras')).toBe('Viewer');
      expect(await page.alerts()).toContain("Can't reach the server. Try again in a moment.");
    });

    it('revokes a Share', async () => {
      const page = await openShareDialog([ANNA, VIEWING_TARAS]);

      page.click('Stop sharing with Taras');
      page.http
        .expectOne(shareRequest('DELETE', TARAS.userId))
        .flush(null, { status: 204, statusText: 'No Content' });

      await page.text();
      expect(page.listItems('Shared with')).toEqual(['Anna anna@example.com Editor']);
    });

    it('keeps the Share, and says so, when revoking it fails', async () => {
      const page = await openShareDialog([VIEWING_TARAS]);

      page.click('Stop sharing with Taras');
      page.http
        .expectOne(shareRequest('DELETE', TARAS.userId))
        .error(new ProgressEvent('error'), { status: 0 });

      expect(await page.alerts()).toContain("Can't reach the server. Try again in a moment.");
      expect(page.listItems('Shared with')).toEqual(['Taras taras@example.com Viewer']);
    });
  });

  it('Shares it with a registered User by email, as a Viewer unless told otherwise', async () => {
    const page = await openShareDialog();
    expect(await page.chosen('Role')).toBe('Viewer');

    await page.fill('Email', ' taras@example.com ');
    await page.choose('Role', 'Editor');
    page.click('Share');
    const share = page.http.expectOne(SHARES);
    expect(share.request.body).toEqual({ email: 'taras@example.com', role: 'EDITOR' });
    share.flush(TARAS);

    await vi.waitFor(() => expect(snackBarText()).toContain('Shared “Groceries” with Taras.'));
    expect(document.querySelector('mat-dialog-container')).toBeNull();
  });

  it('asks for a valid email before sending anything', async () => {
    const page = await openShareDialog();

    page.click('Share');
    expect(await page.fieldErrors('Email')).toEqual(['Enter an email address.']);
    await page.fill('Email', 'taras');
    expect(await page.fieldErrors('Email')).toEqual(['Enter a valid email address.']);
    page.http.expectNone(SHARES);
  });

  it.each([
    ['NOT_REGISTERED', 'No one has registered with this email. Ask them to register first.'],
    ['OWNER', 'That’s your own email.'],
    ['ALREADY_SHARED', 'This Todo List is already Shared with them.'],
  ])('says why the backend refuses the email as %s', async (code, message) => {
    const page = await openShareDialog();

    await page.fill('Email', 'taras@example.com');
    page.click('Share');
    failFieldAsInvalid(page.http.expectOne(SHARES), 'email', code);

    expect(await page.fieldErrors('Email')).toEqual([message]);
    expect(await page.fieldValue('Email')).toBe('taras@example.com');
  });

  it("says so, keeping what was typed, when the server can't be reached", async () => {
    const page = await openShareDialog();

    await page.fill('Email', 'taras@example.com');
    page.click('Share');
    page.http.expectOne(SHARES).error(new ProgressEvent('error'), { status: 0 });

    expect(await page.alerts()).toContain("Can't reach the server. Try again in a moment.");
    expect(await page.fieldValue('Email')).toBe('taras@example.com');
  });
});
