import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coursesRouter from "./courses";
import studentsRouter from "./students";
import feeStructuresRouter from "./fee-structures";
import vouchersRouter from "./vouchers";
import receiptsRouter from "./receipts";
import reportsRouter from "./reports";
import instructorsRouter from "./instructors";
import authRouter from "./auth";
import budgetRouter from "./budget";
import certificatesRouter from "./certificates";
import classesRouter from "./classes";
import attendanceRouter from "./attendance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(coursesRouter);
router.use(studentsRouter);
router.use(feeStructuresRouter);
router.use(vouchersRouter);
router.use(receiptsRouter);
router.use(reportsRouter);
router.use(instructorsRouter);
router.use(budgetRouter);
router.use(certificatesRouter);
router.use(classesRouter);
router.use(attendanceRouter);

export default router;
