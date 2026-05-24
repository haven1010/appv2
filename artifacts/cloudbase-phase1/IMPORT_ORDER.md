# CloudBase 测试库统一导入顺序

以下文件已经按统一账号规则整理完成：

- 工人主账号：`13800000001 / 010001`
- 老板账号：`13800000002 / 010002`
- 超级管理员：`13800000003 / 010003`
- 基地管理员：`13800000004 / 010004`
- 现场管理员：`13800000005 / 010005`
- 额外工人乙：`13800000006 / 010006`
- 额外工人丙：`13800000007 / 010007`

推荐导入顺序：

1. `users.import.json` -> `users`
2. `admin-users.import.json` -> `users`
3. `extra-workers.import.json` -> `users`
4. `bases.import.json` -> `bases`
5. `jobs.import.json` -> `jobs`
6. `applications.test.import.json` -> `applications`
7. `signups.test.import.json` -> `signups`
8. `workerSalaries.import.json` -> `workerSalaries`
9. `salaryReports.import.json` -> `salaryReports`
10. `cooperations.import.json` -> `cooperations`
11. `rightsConsultations.import.json` -> `rightsConsultations`
12. `trainingEnrollments.import.json` -> `trainingEnrollments`
13. `policyApplications.import.json` -> `policyApplications`
14. `operationLogs.import.json` -> `operationLogs`

导入模式建议：

- 新建空集合时：`Insert`
- 已有旧测试数据时：先清空集合，再按上面顺序重新导入
- 不建议对旧脏数据直接 `Upsert`，容易留下重复和历史脏记![1779432134558](image/IMPORT_ORDER/1779432134558.png)![1779432136058](image/IMPORT_ORDER/1779432136058.png)录
