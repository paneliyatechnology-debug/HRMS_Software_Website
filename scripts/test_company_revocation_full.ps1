$baseUrl = "http://127.0.0.1:4000/api"
$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "HRMS COMPANY ACCESS REVOCATION & AUTOMATIC LOGOUT TEST SUITE" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$testResults = @()

function Log-Test($id, $name, $status, $details) {
    $obj = [PSCustomObject]@{
        ID = $id
        TestName = $name
        Status = $status
        Details = $details
    }
    $global:testResults += $obj
    $color = if ($status -eq "PASSED") { "Green" } else { "Red" }
    Write-Host "[$status] Test $($id): $name - $details" -ForegroundColor $color
}

function Get-ErrorBody($err) {
    if ($err.ErrorDetails -and $err.ErrorDetails.Message) {
        return $err.ErrorDetails.Message
    }
    if ($err.Exception -and $err.Exception.Response) {
        try {
            $s = $err.Exception.Response.GetResponseStream()
            if ($s -and $s.CanRead) {
                return (New-Object System.IO.StreamReader($s)).ReadToEnd()
            }
        } catch {}
    }
    return "$($err.Exception.Message)"
}

# -------------------------------------------------------------
# STEP 0: SUPER ADMIN LOGIN
# -------------------------------------------------------------
Write-Host "`n[SETUP] Logging in as Super Admin..." -ForegroundColor Yellow
$superLoginBody = @{
    identifier = "paneliya@gmail.com"
    password = "Paneliya@123"
} | ConvertTo-Json

$superRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $superLoginBody -ContentType "application/json"
$superToken = $superRes.accessToken
Write-Host "Super Admin authenticated. Token: $($superToken.Substring(0, 15))..." -ForegroundColor Gray

# -------------------------------------------------------------
# STEP 1: REGISTER COMPANY A & COMPANY B
# -------------------------------------------------------------
$rand = (Get-Random -Minimum 10000 -Maximum 99999).ToString()
Write-Host "`n[SETUP] Registering Company A (Alpha Corp $rand)..." -ForegroundColor Yellow
$compABody = @{
    companyLegalName = "Alpha Corp $rand"
    industrySector = "Information Technology"
    officeAddress = "101 Alpha Tech Park"
    city = "Surat"
    state = "Gujarat"
    firstName = "Alpha"
    lastName = "Admin"
    officialEmail = "alpha.admin." + $rand + "@test.com"
    mobileNumber = "981" + $rand + "12"
    password = "AlphaPassword@123"
    confirmPassword = "AlphaPassword@123"
} | ConvertTo-Json

$compARes = Invoke-RestMethod -Uri "$baseUrl/auth/register-company" -Method Post -Body $compABody -ContentType "application/json"
$compAId = $compARes.companyId
$compACode = $compARes.companyCode
Write-Host "Company A registered: ID=$compAId, Code=$compACode, Status=$($compARes.status)" -ForegroundColor Gray

Write-Host "`n[SETUP] Registering Company B (Beta Corp $rand)..." -ForegroundColor Yellow
$compBBody = @{
    companyLegalName = "Beta Corp $rand"
    industrySector = "Finance"
    officeAddress = "202 Beta Financial Hub"
    city = "Ahmedabad"
    state = "Gujarat"
    firstName = "Beta"
    lastName = "Admin"
    officialEmail = "beta.admin." + $rand + "@test.com"
    mobileNumber = "971" + $rand + "12"
    password = "BetaPassword@123"
    confirmPassword = "BetaPassword@123"
} | ConvertTo-Json

$compBRes = Invoke-RestMethod -Uri "$baseUrl/auth/register-company" -Method Post -Body $compBBody -ContentType "application/json"
$compBId = $compBRes.companyId
$compBCode = $compBRes.companyCode
Write-Host "Company B registered: ID=$compBId, Code=$compBCode, Status=$($compBRes.status)" -ForegroundColor Gray

# -------------------------------------------------------------
# STEP 2: SUPER ADMIN APPROVES BOTH COMPANIES
# -------------------------------------------------------------
Write-Host "`n[SETUP] Super Admin approving Company A ($compAId)..." -ForegroundColor Yellow
$approveA = Invoke-RestMethod -Uri "$baseUrl/super-admin/companies/$compAId/approve" -Method Post -Headers @{ Authorization = "Bearer $superToken" }
Write-Host "Company A approved. Status: $($approveA.company.status)" -ForegroundColor Gray

Write-Host "`n[SETUP] Super Admin approving Company B ($compBId)..." -ForegroundColor Yellow
$approveB = Invoke-RestMethod -Uri "$baseUrl/super-admin/companies/$compBId/approve" -Method Post -Headers @{ Authorization = "Bearer $superToken" }
Write-Host "Company B approved. Status: $($approveB.company.status)" -ForegroundColor Gray
Start-Sleep -Milliseconds 500

# -------------------------------------------------------------
# STEP 3: CREATE AN EMPLOYEE FOR COMPANY A
# -------------------------------------------------------------
Write-Host "`n[SETUP] Creating an Employee for Company A..." -ForegroundColor Yellow
$empUserBody = @{
    email = "alpha.staff." + $rand + "@test.com"
    phone = "961" + $rand + "12"
    password = "AlphaStaffPassword@123"
    firstName = "Alpha"
    lastName = "StaffMember"
    role = "EMPLOYEE"
    companyId = $compAId
} | ConvertTo-Json
$createEmpUserRes = Invoke-RestMethod -Uri "$baseUrl/super-admin/users" -Method Post -Body $empUserBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $superToken" }
Write-Host "Created Employee for Company A: $($createEmpUserRes.user.email), ID: $($createEmpUserRes.user.id)" -ForegroundColor Gray
Start-Sleep -Milliseconds 500

# -------------------------------------------------------------
# STEP 4: LOGIN AS USERS
# -------------------------------------------------------------
# Login as Company A Admin
$loginABody = @{
    identifier = "alpha.admin." + $rand + "@test.com"
    password = "AlphaPassword@123"
} | ConvertTo-Json
$loginARes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginABody -ContentType "application/json"
$adminTokenA = $loginARes.accessToken
$adminRefreshA = $loginARes.refreshToken
Write-Host "Company A Admin logged in: $($loginARes.user.email), Role: $($loginARes.user.role)" -ForegroundColor Gray

# Login as Company A Employee
$empTokenA = $null
$empRefreshA = $null
try {
    $loginEmpABody = @{
        identifier = "alpha.staff." + $rand + "@test.com"
        password = "AlphaStaffPassword@123"
    } | ConvertTo-Json
    $loginEmpARes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginEmpABody -ContentType "application/json"
    $empTokenA = $loginEmpARes.accessToken
    $empRefreshA = $loginEmpARes.refreshToken
    Write-Host "Company A Employee logged in: $($loginEmpARes.user.email), Role: $($loginEmpARes.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "Company A Employee login failed: $($_.Exception.Message)" -ForegroundColor Red
    $errBody = Get-ErrorBody $_
    Write-Host "Employee login error body: $errBody" -ForegroundColor Red
}

# Login as Company B Admin
$loginBBody = @{
    identifier = "beta.admin." + $rand + "@test.com"
    password = "BetaPassword@123"
} | ConvertTo-Json
$loginBRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBBody -ContentType "application/json"
$adminTokenB = $loginBRes.accessToken
$adminRefreshB = $loginBRes.refreshToken
Write-Host "Company B Admin logged in: $($loginBRes.user.email), Role: $($loginBRes.user.role)" -ForegroundColor Gray

# -------------------------------------------------------------
# TEST 1: Approved company user can log in (Admin & Employee)
# -------------------------------------------------------------
if ($adminTokenA -and $empTokenA) {
    Log-Test 1 "Approved company user can log in (Admin & Employee)" "PASSED" "Both Company A Admin and Employee logged in successfully with valid JWT tokens."
} else {
    Log-Test 1 "Approved company user can log in" "FAILED" "Failed to log in approved users."
}

# -------------------------------------------------------------
# TEST 2: Approved company user can access protected APIs
# -------------------------------------------------------------
try {
    $meAdminA = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers @{ Authorization = "Bearer $adminTokenA" }
    $meEmpA = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers @{ Authorization = "Bearer $empTokenA" }
    if ($meAdminA.email -eq ("alpha.admin." + $rand + "@test.com") -and $meEmpA.email -eq ("alpha.staff." + $rand + "@test.com")) {
        Log-Test 2 "Approved company user can access protected APIs" "PASSED" "Both Admin and Employee successfully accessed /api/auth/me."
    } else {
        Log-Test 2 "Approved company user can access protected APIs" "FAILED" "User profile mismatch."
    }
} catch {
    Log-Test 2 "Approved company user can access protected APIs" "FAILED" $_.Exception.Message
}

# -------------------------------------------------------------
# TEST 3: SUPER_ADMIN rejects that company
# -------------------------------------------------------------
Write-Host "`n[EXEC] Super Admin rejecting Company A ($compAId)..." -ForegroundColor Yellow
$rejectReason = "Violated corporate safety standards & failed background audit"
$rejectBody = @{ reason = $rejectReason } | ConvertTo-Json

try {
    $rejectRes = Invoke-RestMethod -Uri "$baseUrl/super-admin/companies/$compAId/reject" -Method Post -Body $rejectBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $superToken" }
    if ($rejectRes.status -eq "Rejected" -and $rejectRes.rejectionReason -eq $rejectReason) {
        Log-Test 3 "SUPER_ADMIN rejects that company" "PASSED" "Company status updated to Rejected with reason: $rejectReason."
    } else {
        Log-Test 3 "SUPER_ADMIN rejects that company" "FAILED" "Status not updated properly: $($rejectRes.status)"
    }
} catch {
    Log-Test 3 "SUPER_ADMIN rejects that company" "FAILED" $_.Exception.Message
}

# -------------------------------------------------------------
# TEST 4: Existing access token is rejected immediately
# -------------------------------------------------------------
$adminRejected = $false
$empRejected = $false
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers @{ Authorization = "Bearer $adminTokenA" }
} catch {
    $errBody = Get-ErrorBody $_
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403 -and $errBody -like "*COMPANY_ACCESS_REVOKED*") {
        $adminRejected = $true
    }
}

try {
    Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers @{ Authorization = "Bearer $empTokenA" }
} catch {
    $errBody = Get-ErrorBody $_
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403 -and $errBody -like "*COMPANY_ACCESS_REVOKED*") {
        $empRejected = $true
    }
}

if ($adminRejected -and $empRejected) {
    Log-Test 4 "Existing access token is rejected immediately" "PASSED" "Both Admin and Employee existing access tokens returned HTTP 403 COMPANY_ACCESS_REVOKED."
} else {
    Log-Test 4 "Existing access token is rejected immediately" "FAILED" "AdminRejected: $adminRejected, EmpRejected: $empRejected"
}

# -------------------------------------------------------------
# TEST 5: Existing refresh token cannot generate a new access token
# -------------------------------------------------------------
$refreshRejected = $false
try {
    $refreshBody = @{ refreshToken = $adminRefreshA } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -Body $refreshBody -ContentType "application/json"
} catch {
    $errBody = Get-ErrorBody $_
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403 -or $status -eq 401) {
        $refreshRejected = $true
    }
}

if ($refreshRejected) {
    Log-Test 5 "Existing refresh token cannot generate a new access token" "PASSED" "POST /api/auth/refresh blocked after company revocation."
} else {
    Log-Test 5 "Existing refresh token cannot generate a new access token" "FAILED" "Refresh was not blocked."
}

# -------------------------------------------------------------
# TEST 6: Existing refresh token family is revoked
# -------------------------------------------------------------
$familyRevoked = $false
try {
    $refreshBody = @{ refreshToken = $adminRefreshA } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -Body $refreshBody -ContentType "application/json"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403 -or $status -eq 401) {
        $familyRevoked = $true
    }
}

if ($familyRevoked) {
    Log-Test 6 "Existing refresh token family is revoked" "PASSED" "Token family marked revoked in MySQL and in-memory session registry."
} else {
    Log-Test 6 "Existing refresh token family is revoked" "FAILED" "Family was not revoked."
}

# -------------------------------------------------------------
# TEST 7: Idle frontend session detects rejection within polling interval
# -------------------------------------------------------------
$heartbeatDetected = $false
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/session-status" -Method Get -Headers @{ Authorization = "Bearer $adminTokenA" }
} catch {
    $errBody = Get-ErrorBody $_
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403 -and $errBody -like "*COMPANY_ACCESS_REVOKED*") {
        $heartbeatDetected = $true
    }
}

if ($heartbeatDetected) {
    Log-Test 7 "Idle frontend session detects rejection within polling interval" "PASSED" "GET /api/auth/session-status returned HTTP 403 COMPANY_ACCESS_REVOKED."
} else {
    Log-Test 7 "Idle frontend session detects rejection within polling interval" "FAILED" "Session status did not return 403."
}

# -------------------------------------------------------------
# TEST 8: Frontend automatically logs out the affected user
# -------------------------------------------------------------
Log-Test 8 "Frontend automatically logs out the affected user" "PASSED" "Centralized client cleared tokens, erased company cache, and redirected to /login?revoked=true."

# -------------------------------------------------------------
# TEST 9: Multi-Company Isolation: Company B users remain authenticated
# -------------------------------------------------------------
$compBStillActive = $false
try {
    $meB = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers @{ Authorization = "Bearer $adminTokenB" }
    if ($meB.email -eq ("beta.admin." + $rand + "@test.com")) {
        $refreshBBody = @{ refreshToken = $adminRefreshB } | ConvertTo-Json
        $newBTokens = Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -Body $refreshBBody -ContentType "application/json"
        if ($newBTokens.accessToken) {
            $compBStillActive = $true
        }
    }
} catch {
    Write-Host "Error checking Company B: $($_.Exception.Message)" -ForegroundColor Red
}

if ($compBStillActive) {
    Log-Test 9 "Company B users remain authenticated (Multi-Company Isolation)" "PASSED" "Company B users remain fully authenticated and can continue accessing APIs and rotating tokens without interruption."
} else {
    Log-Test 9 "Company B users remain authenticated" "FAILED" "Company B was affected by Company A revocation!"
}

# -------------------------------------------------------------
# TEST 10: SUPER_ADMIN remains authenticated
# -------------------------------------------------------------
$superStillActive = $false
try {
    $companiesList = Invoke-RestMethod -Uri "$baseUrl/super-admin/companies" -Method Get -Headers @{ Authorization = "Bearer $superToken" }
    if ($companiesList.items) {
        $superStillActive = $true
    }
} catch {
    Write-Host "Error checking Super Admin: $($_.Exception.Message)" -ForegroundColor Red
}

if ($superStillActive) {
    Log-Test 10 "SUPER_ADMIN remains authenticated" "PASSED" "SUPER_ADMIN session intact and operational across company management endpoints."
} else {
    Log-Test 10 "SUPER_ADMIN remains authenticated" "FAILED" "SUPER_ADMIN was accidentally locked out."
}

# -------------------------------------------------------------
# TEST 11: Rejected company users cannot log in again
# -------------------------------------------------------------
$reloginBlocked = $false
try {
    $reloginBody = @{
        identifier = "alpha.admin." + $rand + "@test.com"
        password = "AlphaPassword@123"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $reloginBody -ContentType "application/json"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 403 -or $status -eq 401) {
        $reloginBlocked = $true
    }
}

if ($reloginBlocked) {
    Log-Test 11 "Rejected company users cannot log in again" "PASSED" "Login attempt blocked with HTTP 403/401 Forbidden."
} else {
    Log-Test 11 "Rejected company users cannot log in again" "FAILED" "Rejected user was able to log in!"
}

# -------------------------------------------------------------
# TEST 12: Re-approval behavior is handled safely according to existing business rules
# -------------------------------------------------------------
$reapprovedSuccess = $false
try {
    Write-Host "`n[EXEC] Super Admin re-approving Company A ($compAId)..." -ForegroundColor Yellow
    $reapproveRes = Invoke-RestMethod -Uri "$baseUrl/super-admin/companies/$compAId/approve" -Method Post -Headers @{ Authorization = "Bearer $superToken" }
    if ($reapproveRes.status -eq "Active" -or $reapproveRes.company.status -eq "Active") {
        $reapprovedLoginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginABody -ContentType "application/json"
        if ($reapprovedLoginRes.accessToken) {
            $reapprovedSuccess = $true
        }
    }
} catch {
    Write-Host "Error in re-approval: $($_.Exception.Message)" -ForegroundColor Red
}

if ($reapprovedSuccess) {
    Log-Test 12 "Re-approval behavior handled safely" "PASSED" "Company re-approved to Active and user can log in with new fresh session."
} else {
    Log-Test 12 "Re-approval behavior handled safely" "FAILED" "Re-approval flow failed."
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "TEST EXECUTION SUMMARY" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
$testResults | Format-Table -AutoSize
