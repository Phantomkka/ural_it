import type {Page} from "@playwright/test";
export async function view(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/world.ts";
    const { EngineStore } = await import(/* @vite-ignore */ path);
    const c = EngineStore.LastCreatedScene.activeCamera;
    return {
      x: c.position.x,
      z: c.position.z,
      yaw: c.rotation.y,
      pitch: c.rotation.x,
    };
  });
}
export async function face(page: Page, x: number, z: number, pitch = 0) {
  const p = await view(page),
    yaw = Math.atan2(x - p.x, z - p.z);
  await page.evaluate(
    ({ dx, dy }) =>
      document.dispatchEvent(
        new MouseEvent("mousemove", { movementX: dx, movementY: dy }),
      ),
    { dx: (yaw - p.yaw) / 0.002, dy: (pitch - p.pitch) / 0.002 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}
export async function walk(page: Page, axis: "x" | "z", goal: number) {
  await page.evaluate(
    async ({ axis, goal }) => {
      const path = "/src/world.ts";
      const { EngineStore } = await import(/* @vite-ignore */ path);
      const camera = EngineStore.LastCreatedScene.activeCamera;
      const settle = () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
      const end = performance.now() + 45000;
      while (Math.abs(camera.position[axis] - goal) > 0.6) {
        if (performance.now() > end)
          throw Error(
            `Waypoint ${axis} ${goal}: ${JSON.stringify(camera.position)}`,
          );
        const direction = Math.sign(goal - camera.position[axis]);
        const yaw =
          axis === "x"
            ? (direction * Math.PI) / 2
            : direction > 0
              ? 0
              : Math.PI;
        document.dispatchEvent(
          new MouseEvent("mousemove", {
            movementX: (yaw - camera.rotation.y) / 0.002,
            movementY: -camera.rotation.x / 0.002,
          }),
        );
        await settle();
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
        await new Promise((r) => setTimeout(r, 65));
        window.dispatchEvent(new Event("blur"));
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
        await new Promise((r) => setTimeout(r, 100));
        await settle();
      }
    },
    { axis, goal },
  );
}
