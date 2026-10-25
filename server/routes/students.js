const express = require('express');
const router = express.Router();
const studentService = require('../services/studentService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

router.use(authenticate, enforceTenantIsolation);

router.get('/', async (req, res, next) => {
  try {
    const result = await studentService.getStudents(req.tenantId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const student = await studentService.getStudentById(req.tenantId, req.params.id);
    res.json(student);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const result = await studentService.createStudent(req.tenantId, req.body, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const result = await studentService.updateStudent(req.tenantId, req.params.id, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleteMode = req.query.mode || req.body?.mode || 'compliance_anonymize';
    const result = await studentService.deleteStudent(req.tenantId, req.params.id, deleteMode, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
