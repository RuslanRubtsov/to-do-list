package io.github.ruslanrubtsov.todo.appinfo;

import io.github.ruslanrubtsov.todo.api.AppInfoApi;
import io.github.ruslanrubtsov.todo.api.model.AppInfo;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AppInfoController implements AppInfoApi {

    private final AppInfo appInfo;

    AppInfoController(BuildProperties buildProperties) {
        this.appInfo = new AppInfo(
                buildProperties.getName(),
                buildProperties.getVersion(),
                OffsetDateTime.ofInstant(buildProperties.getTime(), ZoneOffset.UTC));
    }

    @Override
    public ResponseEntity<AppInfo> getAppInfo() {
        return ResponseEntity.ok(appInfo);
    }
}
