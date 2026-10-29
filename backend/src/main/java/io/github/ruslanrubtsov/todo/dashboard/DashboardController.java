package io.github.ruslanrubtsov.todo.dashboard;

import io.github.ruslanrubtsov.todo.api.DashboardApi;
import io.github.ruslanrubtsov.todo.api.model.Dashboard;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
class DashboardController implements DashboardApi {

    private final DashboardService dashboardService;

    DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @Override
    public ResponseEntity<Dashboard> getDashboard() {
        return ResponseEntity.ok(dashboardService.dashboard(CurrentUser.id()));
    }
}
