import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Priority, Task } from '@api';
import { MILK, openTask, taskRequest } from '../../testing/tasks';
import { openDetails, renderTodoListPage } from '../../testing/todo-list-page';
import { failFieldAsInvalid, GROCERIES } from '../../testing/todo-lists';

// The first test renders lazy routes, a dialog, a date picker and a select cold, which under a
// parallel run takes longer than other files' first tests
vi.setConfig({ testTimeout: 30_000 });

/** Noon on Wednesday 28 October 2026, in the time zone the tests run in. */
const NOW = new Date('2026-10-28T10:00:00Z');

/** The Todo List page, on {@link NOW}. Only the date is faked; timers run as usual. */
function renderOn(tasks: Task[]) {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  return renderTodoListPage(GROCERIES, { tasks });
}

describe('Task details', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  describe('changing them', () => {
    it("changes a Task's title, description, Due Date and Priority", async () => {
      const page = await renderOn([MILK]);

      await openDetails(page, 'Edit “Buy milk”');
      expect(await page.fieldValue('Title')).toBe('Buy milk');
      expect(await page.chosen('Priority')).toBe('Medium');
      await page.fill('Title', ' Buy oat milk ');
      await page.fill('Description', 'Two cartons');
      await page.fill('Due Date', '11/3/2026');
      await page.choose('Priority', 'High');
      page.click('Save');

      const update = page.http.expectOne(taskRequest('PUT', 5, MILK.id));
      expect(update.request.body).toEqual({
        title: 'Buy oat milk',
        description: 'Two cartons',
        dueDate: '2026-11-03',
        priority: Priority.HIGH,
      });
      update.flush({
        ...MILK,
        title: 'Buy oat milk',
        description: 'Two cartons',
        dueDate: '2026-11-03',
        priority: Priority.HIGH,
      });

      await vi.waitFor(() =>
        expect(page.listItems('Open Tasks')).toEqual([
          'Buy oat milk Two cartons High Priority Due Nov 3, 2026',
        ]),
      );
    });

    it('clears the details taken out', async () => {
      const page = await renderOn([
        { ...MILK, description: 'Two cartons', dueDate: '2026-11-03', priority: Priority.HIGH },
      ]);

      await openDetails(page, 'Edit “Buy milk”');
      expect(await page.fieldValue('Due Date')).toBe('11/03/2026');
      await page.fill('Description', '  ');
      await page.fill('Due Date', '');
      await page.choose('Priority', 'Low');
      page.click('Save');

      expect(page.http.expectOne(taskRequest('PUT', 5, MILK.id)).request.body).toEqual({
        title: 'Buy milk',
        description: null,
        dueDate: null,
        priority: Priority.LOW,
      });
    });

    it('asks for a title, and for a Due Date it can read', async () => {
      const page = await renderOn([MILK]);

      await openDetails(page, 'Edit “Buy milk”');
      await page.fill('Title', ' ');
      await page.fill('Due Date', 'soon');
      page.click('Save');

      expect(await page.fieldErrors('Title')).toEqual(['Enter a title.']);
      expect(await page.fieldErrors('Due Date')).toEqual(['Enter a date such as 12/31/2026.']);
      page.http.expectNone(taskRequest('PUT', 5, MILK.id));
    });

    it('shows the error the server gives for a field next to it', async () => {
      const page = await renderOn([MILK]);

      await openDetails(page, 'Edit “Buy milk”');
      await page.fill('Description', 'Two cartons');
      page.click('Save');
      failFieldAsInvalid(
        page.http.expectOne(taskRequest('PUT', 5, MILK.id)),
        'description',
        'SIZE',
      );

      expect(await page.fieldErrors('Description')).toEqual(['Use at most 2000 characters.']);
    });

    it('changes nothing when cancelled', async () => {
      const page = await renderOn([MILK]);

      await openDetails(page, 'Edit “Buy milk”');
      await page.fill('Title', 'Buy oat milk');
      page.click('Cancel');

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
      page.http.expectNone(taskRequest('PUT', 5, MILK.id));
    });
  });

  it('shows when Tasks are due, relative to today where that helps', async () => {
    const page = await renderOn([
      { ...openTask(31, 'Today'), dueDate: '2026-10-28' },
      { ...openTask(32, 'Tomorrow'), dueDate: '2026-10-29' },
      { ...openTask(33, 'Next week'), dueDate: '2026-11-03' },
    ]);

    expect(page.listItems('Open Tasks')).toEqual([
      'Today Due today',
      'Tomorrow Due tomorrow',
      'Next week Due Nov 3, 2026',
    ]);
  });

  it('highlights Overdue Tasks, as the backend reckons them', async () => {
    const page = await renderOn([
      { ...openTask(31, 'Late'), dueDate: '2026-10-27', overdue: true },
      { ...openTask(32, 'On time'), dueDate: '2026-10-28', overdue: false },
    ]);

    expect(page.listItems('Open Tasks')).toEqual([
      'Late Overdue Due yesterday',
      'On time Due today',
    ]);
  });

  it('marks High and Low Priority, but not the usual Medium', async () => {
    const page = await renderOn([
      { ...openTask(31, 'Urgent'), priority: Priority.HIGH },
      { ...openTask(32, 'Usual'), priority: Priority.MEDIUM },
      { ...openTask(33, 'Whenever'), priority: Priority.LOW },
    ]);

    expect(page.listItems('Open Tasks')).toEqual([
      'Urgent High Priority',
      'Usual',
      'Whenever Low Priority',
    ]);
  });
});
