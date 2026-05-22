import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import departmentsRouter from "./departments";
import employeesRouter from "./employees";
import krasRouter from "./kras";
import kpisRouter from "./kpis";
import tasksRouter from "./tasks";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(departmentsRouter);
router.use(employeesRouter);
router.use(krasRouter);
router.use(kpisRouter);
router.use(tasksRouter);
router.use(dashboardRouter);

export default router;
