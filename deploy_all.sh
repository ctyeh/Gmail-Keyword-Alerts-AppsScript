#!/bin/bash
set -e

# 顏色設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定根目錄的絕對路徑（腳本所在目錄）
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="${ROOT_DIR}/deploy/test"
PROD_DIR="${ROOT_DIR}/deploy/prod"

echo -e "${GREEN}工作根目錄: ${ROOT_DIR}${NC}"

# 檢查 clasp 是否已安裝
if ! command -v clasp &> /dev/null; then
  echo -e "${RED}錯誤：clasp 未安裝，請先執行 'npm install -g @google/clasp' 安裝${NC}"
  exit 1
fi

# 手動引導使用者進行 clasp 登入
manual_clasp_login() {
  local env_type="$1"
  local work_dir="$2"
  
  echo -e "${YELLOW}======= 手動登入 ${env_type} 環境 =======${NC}"
  echo -e "${YELLOW}請按照以下步驟操作：${NC}"
  echo -e "${BLUE}1. 請在終端機中執行以下命令：${NC}"
  echo -e "${GREEN}   cd ${work_dir}${NC}"
  echo -e "${GREEN}   clasp login${NC}"
  echo -e "${BLUE}2. 瀏覽器會自動開啟 Google 授權頁面${NC}"
  echo -e "${BLUE}3. 請使用${env_type}環境的 Google 帳號登入並授權${NC}"
  echo -e "${BLUE}4. 完成授權後，返回終端機${NC}"
  
  # 詢問使用者是否已完成登入
  while true; do
    read -p "您是否已完成 ${env_type} 環境的登入授權？(y/n) " yn
    case $yn in
      [Yy]* )
        # 驗證登入狀態
        cd "$work_dir"
        if clasp login --status &> /dev/null; then
          echo -e "${GREEN}${env_type}環境登入成功！${NC}"
          return 0
        else
          echo -e "${RED}登入驗證失敗。請確認您已完成授權。${NC}"
          
          # 再次詢問是否要繼續
          read -p "是否再試一次？(y/n) " retry
          case $retry in
            [Yy]* ) continue;;
            * ) return 1;;
          esac
        fi
        ;;
      [Nn]* )
        echo -e "${RED}放棄${env_type}環境登入${NC}"
        return 1
        ;;
      * ) echo -e "${YELLOW}請輸入 y 或 n${NC}";;
    esac
  done
}

# 確保 ~/.clasprc.json 有適當的權限
fix_clasprc_permissions() {
  if [ -f ~/.clasprc.json ]; then
    echo -e "${YELLOW}確保 ~/.clasprc.json 權限正確...${NC}"
    chmod 600 ~/.clasprc.json
    echo -e "${GREEN}已設置 ~/.clasprc.json 權限為 600${NC}"
  else
    echo -e "${RED}警告: ~/.clasprc.json 不存在，可能需要重新登入${NC}"
  fi
}

# 檢查憑證文件是否存在並顯示相關信息
check_credentials() {
  echo -e "${YELLOW}檢查 clasp 憑證狀態...${NC}"
  
  if [ -f ~/.clasprc.json ]; then
    echo -e "${GREEN}找到 ~/.clasprc.json 檔案${NC}"
    # 顯示檔案的權限和大小
    ls -la ~/.clasprc.json
    
    # 確認檔案不為空
    if [ -s ~/.clasprc.json ]; then
      echo -e "${GREEN}憑證檔案有內容${NC}"
    else
      echo -e "${RED}警告：憑證檔案為空${NC}"
    fi
  else
    echo -e "${RED}錯誤：找不到 ~/.clasprc.json 憑證檔案${NC}"
    return 1
  fi
  
  # 嘗試獲取登入狀態
  echo -e "${YELLOW}檢查 clasp 登入狀態...${NC}"
  if clasp login --status; then
    echo -e "${GREEN}clasp 已登入${NC}"
    return 0
  else
    echo -e "${RED}clasp 未登入或登入狀態無效${NC}"
    return 1
  fi
}

# 驗證並修復 .clasp.json 檔案的函數
validate_clasp_json() {
  local env_dir="$1"
  local env_type="$2"
  
  echo -e "${YELLOW}驗證 ${env_type} 環境的 .clasp.json 檔案...${NC}"
  
  if [ ! -f "$env_dir/.clasp.json" ]; then
    echo -e "${RED}錯誤：${env_type} 目錄中缺少 .clasp.json 檔案${NC}"
    echo -e "${YELLOW}請在 ${env_type} 目錄中手動創建 .clasp.json 檔案，包含以下內容：${NC}"
    echo -e "${BLUE}{\"scriptId\":\"您的Script_ID\",\"rootDir\":\".\"}"
    return 1
  fi
  
  # 檢查 .clasp.json 是否為有效的 JSON
  if cat "$env_dir/.clasp.json" | grep -q "scriptId"; then
    echo -e "${GREEN}.clasp.json 檔案有效${NC}"
    # 顯示檔案內容摘要
    echo -e "${YELLOW}.clasp.json 內容:${NC}"
    cat "$env_dir/.clasp.json"
    return 0
  else
    echo -e "${RED}錯誤：.clasp.json 中找不到 scriptId${NC}"
    return 1
  fi
}

# 部署到指定環境的函數
deploy_to_environment() {
  local env_type="$1"   # 環境類型（測試/正式）
  local env_dir="$2"    # 環境目錄
  local sync_script="$3" # 同步腳本名稱
  
  echo -e "${GREEN}====== 開始同步並部署到${env_type}環境 ======${NC}"
  
  # 執行同步腳本（回到根目錄執行）
  cd "$ROOT_DIR"
  echo -e "${GREEN}執行同步腳本: ${sync_script}${NC}"
  "./${sync_script}" || {
    echo -e "${RED}執行 ${sync_script} 失敗${NC}"
    return 1
  }
  
  # 驗證環境目錄中的 .clasp.json 檔案
  if ! validate_clasp_json "$env_dir" "$env_type"; then
    echo -e "${RED}${env_type}環境的 .clasp.json 檔案有問題，請修復後再試${NC}"
    return 1
  fi
  
  # 切換到環境目錄
  cd "$env_dir"
  
  # 推送前檢查憑證狀態
  check_credentials || {
    echo -e "${YELLOW}嘗試修復憑證問題...${NC}"
    fix_clasprc_permissions
    
    # 再次檢查憑證
    check_credentials || {
      echo -e "${RED}憑證檢查失敗，嘗試重新登入${NC}"
      if ! manual_clasp_login "${env_type}" "$env_dir"; then
        echo -e "${RED}無法修復憑證問題，請嘗試手動執行：${NC}"
        echo -e "${GREEN}1. cd ${env_dir}${NC}"
        echo -e "${GREEN}2. rm -f ~/.clasprc.json (移除舊憑證)${NC}"
        echo -e "${GREEN}3. clasp login (重新登入)${NC}"
        return 1
      fi
    }
  }
  
  echo -e "${GREEN}推送到${env_type}環境...${NC}"
  clasp push -f || {
    echo -e "${RED}${env_type}環境推送失敗，可能需要重新登入${NC}"
    
    # 嘗試手動登入
    if manual_clasp_login "${env_type}" "$env_dir"; then
      echo -e "${GREEN}重新嘗試推送到${env_type}環境...${NC}"
      clasp push -f || {
        echo -e "${RED}${env_type}環境推送仍然失敗${NC}"
        echo -e "${RED}嘗試使用絕對路徑指定憑證檔案${NC}"
        CREDS_PATH="$HOME/.clasprc.json"
        echo -e "${GREEN}使用憑證路徑: ${CREDS_PATH}${NC}"
        CLASP_CREDS="$CREDS_PATH" clasp push -f || {
          echo -e "${RED}${env_type}環境推送再次失敗${NC}"
          return 1
        }
      }
    else
      return 1
    fi
  }
  
  echo -e "${GREEN}${env_type}環境推送成功${NC}"
  return 0
}

# 清理舊憑證並手動重新登入
cleanup_and_manual_login() {
  echo -e "${YELLOW}清理舊的憑證...${NC}"
  
  # 備份當前憑證（如果存在）
  if [ -f ~/.clasprc.json ]; then
    mv ~/.clasprc.json ~/.clasprc.json.old
    echo -e "${GREEN}已備份舊憑證到 ~/.clasprc.json.old${NC}"
  fi
  
  # 移除可能造成問題的檔案
  rm -f ~/.clasprc.json.test ~/.clasprc.json.prod 2>/dev/null || true
  
  # 手動引導測試環境登入
  manual_clasp_login "測試環境" "$TEST_DIR" || {
    echo -e "${RED}測試環境登入失敗，無法繼續部署${NC}"
    return 1
  }
  
  fix_clasprc_permissions
  return 0
}

# 主部署流程
echo -e "${GREEN}===== 開始部署流程 =====${NC}"

# 檢查是否有參數 '--clean' 強制清理憑證
if [[ "$1" == "--clean" ]]; then
  cleanup_and_manual_login || {
    echo -e "${RED}清理憑證失敗，中止部署流程${NC}"
    exit 1
  }
fi

# 檢查權限並修復
fix_clasprc_permissions

# 部署到測試環境
deploy_to_environment "測試" "$TEST_DIR" "sync_test.sh" || {
  echo -e "${RED}測試環境部署失敗${NC}"
  exit 1
}

# 備份測試環境的憑證
if [ -f ~/.clasprc.json ]; then
  cp ~/.clasprc.json ~/.clasprc.json.test 2>/dev/null || true
  echo -e "${GREEN}已備份測試環境憑證${NC}"
fi

# 詢問是否要部署到正式環境
read -p "是否要部署到正式環境？(y/n) " yn
case $yn in
  [Yy]* )
    # 部署到正式環境前，先引導手動登入
    manual_clasp_login "正式環境" "$PROD_DIR" || {
      echo -e "${RED}正式環境登入失敗，無法部署到正式環境${NC}"
      
      # 恢復測試環境的憑證
      if [ -f ~/.clasprc.json.test ]; then
        cp ~/.clasprc.json.test ~/.clasprc.json 2>/dev/null || true
        echo -e "${GREEN}已還原測試環境的憑證${NC}"
      fi
      
      exit 1
    }
    
    # 部署到正式環境
    deploy_to_environment "正式" "$PROD_DIR" "sync_prod.sh" || {
      echo -e "${RED}正式環境部署失敗${NC}"
    }
    
    # 備份正式環境的憑證
    if [ -f ~/.clasprc.json ]; then
      cp ~/.clasprc.json ~/.clasprc.json.prod 2>/dev/null || true
      echo -e "${GREEN}已備份正式環境憑證${NC}"
    fi
    
    # 恢復測試環境的憑證
    if [ -f ~/.clasprc.json.test ]; then
      cp ~/.clasprc.json.test ~/.clasprc.json 2>/dev/null || true
      echo -e "${GREEN}已還原測試環境的憑證${NC}"
      fix_clasprc_permissions
    fi
    ;;
  * )
    echo -e "${YELLOW}跳過正式環境部署${NC}"
    ;;
esac

echo -e "${GREEN}部署流程完成${NC}"
